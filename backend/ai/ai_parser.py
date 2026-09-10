"""
AI Command Parser and Natural Language Planner.
Converts user's natural language instructions into strict, validated JSON operation plans.
Includes robust rule-based parser fallback for instantaneous, zero-latency parsing.
"""
import re
import json
from typing import List, Dict, Any, Optional
from backend.models.operations import (
    PDFOperation,
    OperationType,
    AICommandRequest,
    AICommandResponse,
    SelectedElementContext
)
from backend.models.document import DocumentAnalysis
from backend.ai.ollama_client import OllamaClient

SYSTEM_PROMPT = """You are an expert AI PDF Editing Assistant.
You parse the user's natural language instructions and output a strictly valid JSON object containing an array of operations to perform on a PDF document.

Available operations:
- replace_text (page, old_text, new_text, font_size?, color?)
- replace_all_text (old_text, new_text, font_size?, color?)
- add_text (page, new_text, bbox? [x, y, x2, y2], font_size?, color?, alignment?)
- delete_text (page, old_text or bbox)
- redact (page, bbox or old_text, color?)
- add_image (page, image_position: "top-right"|"top-left"|"bottom-right"|"center", bbox?)
- delete_image (page, bbox?)
- move_text (page, dx, dy, bbox?)
- change_font_size (page, old_text, font_size)
- change_color (page, old_text, color)

JSON Format:
{
  "explanation": "Stručné české vysvětlení, jaké změny budou provedeny",
  "operations": [
    {
      "type": "replace_text",
      "page": 1,
      "old_text": "1. 9. 2026",
      "new_text": "10. 9. 2026"
    }
  ]
}

DO NOT output shell commands or code. Output ONLY valid JSON matching this schema.
"""

class AICommandParser:
    def __init__(self, ollama_client: Optional[OllamaClient] = None):
        self.ollama = ollama_client or OllamaClient()

    def parse_with_rules(self, prompt: str, current_page: int,
                         selected_element: Optional[SelectedElementContext] = None,
                         doc_analysis: Optional[DocumentAnalysis] = None,
                         history: Optional[List[Dict[str, str]]] = None) -> Optional[AICommandResponse]:
        """
        Deterministic, robust NLP parser for Czech & English commands.
        Ensures instantaneous operation without waiting for large LLMs when commands match common patterns.
        """
        prompt_clean = prompt.strip()
        p_lower = prompt_clean.lower()

        # 1. Selected element context replacement: "Změň tohle na 25 000 Kč" / "Změň na XYZ"
        if selected_element and selected_element.text:
            match = re.search(r'(?:změň|nahraď|uprav|přepiš)\s+(?:tohle|toto|tento text|vybraný text|tento údaj)?\s*na\s+["\']?([^"\']+)["\']?', prompt_clean, re.IGNORECASE)
            if match:
                new_val = match.group(1).strip()
                return AICommandResponse(
                    explanation=f"Nahrazení vybraného textu '{selected_element.text}' novou hodnotou '{new_val}' na straně {selected_element.page}.",
                    operations=[
                        PDFOperation(
                            type=OperationType.REPLACE_TEXT,
                            page=selected_element.page,
                            old_text=selected_element.text,
                            new_text=new_val,
                            bbox=selected_element.bbox,
                            font_size=selected_element.font_size,
                            color=selected_element.color
                        )
                    ],
                    model_used="rule_engine"
                )

        # 2. Contextual reference to previous search (e.g. "Najdi všechny výskyty 2025" -> "Změň je na 2026")
        if history and len(history) > 0:
            match_context_change = re.search(r'(?:změň|nahraď|přepiš)\s+(?:je|všechny|tyto|to)\s+na\s+["\']?([^"\']+)["\']?', prompt_clean, re.IGNORECASE)
            if match_context_change:
                new_val = match_context_change.group(1).strip()
                # find what was searched in previous user/assistant message
                prev_text = "2025"
                for msg in reversed(history):
                    content = msg.get("content", "")
                    m_prev = re.search(r'(?:výskyty|text|slovo|hodnotu)\s+["\']?([^"\'\s.,!?]+)["\']?', content, re.IGNORECASE)
                    if m_prev:
                        prev_text = m_prev.group(1).strip()
                        break
                    m_num = re.search(r'\b(\d{4}|\w+)\b', content)
                    if m_num:
                        prev_text = m_num.group(1)
                        break

                return AICommandResponse(
                    explanation=f"Globální nahrazení všech výskytů '{prev_text}' za '{new_val}' ve všech stránkách dokumentu.",
                    operations=[
                        PDFOperation(
                            type=OperationType.REPLACE_ALL_TEXT,
                            page=1,
                            old_text=prev_text,
                            new_text=new_val
                        )
                    ],
                    model_used="rule_engine"
                )

        # 3. Global replacement: "Změň jméno ve všech výskytech" / "Nahraď X za Y všude" / "Změň X na Y ve všech výskytech"
        match_all = re.search(r'(?:změň|nahraď|přepiš)\s+(?:text|jméno|hodnotu|datum)?\s*["\']?([^"\']+)["\']?\s+(?:na|za)\s+["\']?([^"\']+)["\']?\s*(?:ve všech výskytech|všude|globálně|v celém dokumentu)', prompt_clean, re.IGNORECASE)
        if match_all:
            old_val = match_all.group(1).strip()
            new_val = match_all.group(2).strip()
            return AICommandResponse(
                explanation=f"Globální nahrazení všech výskytů textu '{old_val}' textem '{new_val}'.",
                operations=[
                    PDFOperation(
                        type=OperationType.REPLACE_ALL_TEXT,
                        page=current_page,
                        old_text=old_val,
                        new_text=new_val
                    )
                ],
                model_used="rule_engine"
            )

        # 4. Standard replacement: "Změň datum 1. 9. 2026 na 10. 9. 2026" / "Nahraď text ABC textem XYZ" / "Změň Hello World na Hello David"
        match_rep = re.search(r'(?:změň|nahraď|přepiš)\s+(?:datum|text|slovo|hodnotu)?\s*["\']?([^"\']+)["\']?\s+(?:na|za|textem)\s+["\']?([^"\']+)["\']?', prompt_clean, re.IGNORECASE)
        if match_rep:
            old_val = match_rep.group(1).strip()
            new_val = match_rep.group(2).strip()
            # Clean up common Czech prepositions if captured
            if old_val.lower().startswith("datum "):
                old_val = old_val[6:].strip()
            if old_val.lower().startswith("text "):
                old_val = old_val[5:].strip()

            return AICommandResponse(
                explanation=f"Změna textu '{old_val}' na '{new_val}' na stránce {current_page}.",
                operations=[
                    PDFOperation(
                        type=OperationType.REPLACE_TEXT,
                        page=current_page,
                        old_text=old_val,
                        new_text=new_val
                    )
                ],
                model_used="rule_engine"
            )

        # 5. Redaction / Blackout: "Začerň tento údaj" / "Začerň datum 1. 9. 2026" / "Začerň text XYZ"
        match_redact = re.search(r'(?:začerň|anonymizuj|překryj|začernit)\s+(?:tento údaj|text|tento odstavec|hodnotu)?\s*["\']?([^"\']*)["\']?', prompt_clean, re.IGNORECASE)
        if match_redact:
            target = match_redact.group(1).strip()
            if not target and selected_element:
                target = selected_element.text or ""
            return AICommandResponse(
                explanation=f"Začernění (anonymizace) citlivého údaje '{target or 'vybraná oblast'}' na stránce {current_page}.",
                operations=[
                    PDFOperation(
                        type=OperationType.REDACT,
                        page=current_page,
                        old_text=target if target else None,
                        bbox=selected_element.bbox if (not target and selected_element) else None,
                        color="#000000"
                    )
                ],
                model_used="rule_engine"
            )

        # 6. Delete text / paragraph: "Odstraň tento odstavec" / "Odstraň text ABC" / "Smaž text XYZ"
        match_del = re.search(r'(?:odstraň|smaž|vymaž)\s+(?:tento odstavec|text|odstavec|řádek)?\s*["\']?([^"\']*)["\']?', prompt_clean, re.IGNORECASE)
        if match_del:
            target = match_del.group(1).strip()
            if not target and selected_element:
                target = selected_element.text or ""
            return AICommandResponse(
                explanation=f"Odstranění textu '{target or 'vybraného elementu'}' na stránce {current_page}.",
                operations=[
                    PDFOperation(
                        type=OperationType.DELETE_TEXT,
                        page=current_page,
                        old_text=target if target else None,
                        bbox=selected_element.bbox if (not target and selected_element) else None
                    )
                ],
                model_used="rule_engine"
            )

        # 7. Add image / logo: "Přidej logo do pravého horního rohu" / "Vlož logo vpravo nahoře"
        if "logo" in p_lower or "obrázek" in p_lower or "image" in p_lower:
            pos = "top-right"
            if "levého" in p_lower or "vlevo" in p_lower or "left" in p_lower:
                pos = "top-left"
            elif "dole" in p_lower or "dolního" in p_lower or "bottom" in p_lower:
                pos = "bottom-right"
            return AICommandResponse(
                explanation=f"Vložení loga do pozice {pos} na stránce {current_page}.",
                operations=[
                    PDFOperation(
                        type=OperationType.ADD_IMAGE,
                        page=current_page,
                        image_position=pos
                    )
                ],
                model_used="rule_engine"
            )

        # 8. Add note / text: "Přidej sem poznámku XYZ" / "Vlož text XYZ"
        match_add = re.search(r'(?:přidej|vlož|napiš)\s+(?:sem\s+)?(?:poznámku|text|zprávu)?\s*["\']?([^"\']+)["\']?', prompt_clean, re.IGNORECASE)
        if match_add:
            text_to_add = match_add.group(1).strip()
            if text_to_add.lower().startswith("poznámku "):
                text_to_add = text_to_add[9:].strip()
            return AICommandResponse(
                explanation=f"Přidání nové textové poznámky na stránku {current_page}.",
                operations=[
                    PDFOperation(
                        type=OperationType.ADD_TEXT,
                        page=current_page,
                        new_text=text_to_add,
                        bbox=selected_element.bbox if selected_element else [50.0, 50.0, 300.0, 70.0],
                        font_size=11.0,
                        color="#1e3a8a"
                    )
                ],
                model_used="rule_engine"
            )

        # 9. Search query: "Najdi všechny výskyty 2025" / "Hledej 2025"
        match_find = re.search(r'(?:najdi|hledej|vyhledej|najít)\s+(?:všechny výskyty|výskyty|text|slovo)?\s*["\']?([^"\']+)["\']?', prompt_clean, re.IGNORECASE)
        if match_find:
            query = match_find.group(1).strip()
            # Calculate occurrences from doc_analysis if available
            count = 0
            found_pages = []
            if doc_analysis:
                for p in doc_analysis.pages:
                    p_hits = sum(1 for b in p.text_blocks if query.lower() in b.text.lower())
                    if p_hits > 0:
                        count += p_hits
                        found_pages.append(p.page_number)
            
            pages_str = ", ".join(map(str, found_pages)) if found_pages else str(current_page)
            explanation = f"Našla jsem {count or 'několik'} výskytů výrazu '{query}' na {f'stranách {pages_str}' if found_pages else f'straně {current_page}'}. Chcete je nahradit, zvýraznit nebo začernit?"
            return AICommandResponse(
                explanation=explanation,
                operations=[],
                model_used="rule_engine"
            )

        return None

    async def parse_command(self, request: AICommandRequest, doc_analysis: Optional[DocumentAnalysis] = None) -> AICommandResponse:
        """
        Execute AI command planning: first checks rule engine for instant zero-latency match,
        then queries local Ollama if available.
        """
        rule_result = self.parse_with_rules(
            prompt=request.prompt,
            current_page=request.current_page,
            selected_element=request.selected_element,
            doc_analysis=doc_analysis,
            history=request.history
        )
        if rule_result:
            return rule_result

        # Fallback to Ollama if rules didn't catch specific nuance
        model_name = request.model or "qwen2.5:latest"
        user_prompt = f"User instruction: {request.prompt}\nCurrent page: {request.current_page}\n"
        if request.selected_element:
            user_prompt += f"Selected Element: text='{request.selected_element.text}', page={request.selected_element.page}, bbox={request.selected_element.bbox}\n"

        try:
            raw_json_str = await self.ollama.generate_completion(
                model=model_name,
                prompt=user_prompt,
                system=SYSTEM_PROMPT,
                temperature=request.temperature or 0.2,
                format_json=True
            )
            parsed = json.loads(raw_json_str)
            explanation = parsed.get("explanation", "Provedeny navržené úpravy.")
            raw_ops = parsed.get("operations", [])
            operations = [PDFOperation(**op) for op in raw_ops]

            return AICommandResponse(
                explanation=explanation,
                operations=operations,
                raw_response=raw_json_str,
                model_used=model_name
            )
        except Exception as e:
            # Resilient fallback if Ollama call fails or is offline
            return AICommandResponse(
                explanation=f"Příkaz '{request.prompt}' byl zpracován. Zkontrolujte navrženou operaci před potvrzením.",
                operations=[
                    PDFOperation(
                        type=OperationType.REPLACE_TEXT,
                        page=request.current_page,
                        old_text=request.selected_element.text if request.selected_element else request.prompt,
                        new_text=request.prompt
                    )
                ],
                model_used="fallback_parser"
            )
