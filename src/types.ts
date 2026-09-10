export type OperationType =
  | 'replace_text'
  | 'replace_all_text'
  | 'add_text'
  | 'delete_text'
  | 'redact'
  | 'add_image'
  | 'delete_image'
  | 'move_text'
  | 'change_font_size'
  | 'change_font'
  | 'change_alignment'
  | 'change_color'
  | 'duplicate_element';

export interface PDFOperation {
  type: OperationType;
  page?: number;
  old_text?: string;
  new_text?: string;
  bbox?: [number, number, number, number];
  font_size?: number;
  font_name?: string;
  color?: string;
  alignment?: 'left' | 'center' | 'right';
  image_position?: 'top-right' | 'top-left' | 'bottom-right' | 'center' | 'custom';
  image_data?: string;
  width?: number;
  height?: number;
  dx?: number;
  dy?: number;
  element_id?: string;
}

export interface TextBlock {
  id: string;
  text: string;
  bbox: [number, number, number, number]; // [x0, y0, x1, y1]
  font_name: string;
  font_size: number;
  color: string;
  page: number;
  line_count: number;
}

export interface ImageBlock {
  id: string;
  bbox: [number, number, number, number];
  page: number;
  width: number;
  height: number;
  format: string;
}

export interface PageInfo {
  page_number: number;
  width: number;
  height: number;
  rotation: number;
  text_blocks: TextBlock[];
  image_blocks: ImageBlock[];
  has_text_layer: boolean;
  is_scanned: boolean;
}

export interface RevisionInfo {
  id: string;
  revision_number: number;
  timestamp: string;
  description: string;
  operations_count: number;
  modified_pages: number[];
}

export interface DocumentMetadata {
  id: string;
  filename: string;
  original_filename: string;
  total_pages: number;
  file_size_bytes: number;
  created_at: string;
  current_revision: number;
  total_revisions: number;
  has_ocr_content: boolean;
  pages: PageInfo[];
}

export interface DocumentAnalysis {
  metadata: DocumentMetadata;
  pages: PageInfo[];
}

export interface AICommandResponse {
  explanation: string;
  operations: PDFOperation[];
  raw_response?: string;
  model_used?: string;
}

export interface AppSettings {
  ollama_url: string;
  model: string;
  temperature: number;
  auto_apply: boolean;
  keep_revision_history: boolean;
  output_directory: string;
  ai_engine: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  operations?: PDFOperation[];
  model_used?: string;
  status?: 'pending_review' | 'applied' | 'cancelled';
}

export interface SelectedElement {
  id: string;
  page: number;
  text: string;
  bbox: [number, number, number, number];
  fontSize: number;
  fontName: string;
  color: string;
}
