import { DocumentAnalysis, AICommandResponse, AppSettings, RevisionInfo, PDFOperation } from '../types';

export const api = {
  async getHealth() {
    const res = await fetch('/api/health');
    return res.json();
  },

  async uploadDocument(file: File, password?: string): Promise<DocumentAnalysis> {
    const formData = new FormData();
    formData.append('file', file);
    if (password) {
      formData.append('password', password);
    }
    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      if (err.requires_password || err.is_password_protected) {
        return err as DocumentAnalysis;
      }
      throw new Error(err.error || err.message || err.detail || 'Upload failed');
    }
    return res.json();
  },

  async unlockDocument(docId: string, password: string): Promise<DocumentAnalysis> {
    const res = await fetch(`/api/documents/${docId}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Odemčení se nezdařilo' }));
      throw new Error(err.message || err.error || 'Zadané heslo není správné.');
    }
    return res.json();
  },

  async loadSampleDocument(): Promise<DocumentAnalysis> {
    const res = await fetch('/api/documents/sample', { method: 'POST' });
    if (!res.ok) {
      throw new Error('Failed to create sample document');
    }
    return res.json();
  },

  async loadSampleLockedDocument(): Promise<DocumentAnalysis> {
    const res = await fetch('/api/documents/sample-locked', { method: 'POST' });
    if (!res.ok) {
      throw new Error('Failed to create sample locked document');
    }
    return res.json();
  },

  async getDocument(docId: string): Promise<DocumentAnalysis> {
    const res = await fetch(`/api/documents/${docId}`);
    if (!res.ok) throw new Error('Document not found');
    return res.json();
  },

  getDocumentPdfUrl(docId: string): string {
    return `/api/documents/${docId}/pdf?t=${Date.now()}`;
  },

  getOriginalPdfUrl(docId: string): string {
    return `/api/documents/${docId}/original-pdf?t=${Date.now()}`;
  },

  async sendAiCommand(
    docId: string,
    prompt: string,
    currentPage: number,
    selectedElement?: any,
    model?: string
  ): Promise<AICommandResponse> {
    const res = await fetch(`/api/documents/${docId}/ai-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        current_page: currentPage,
        selected_element: selectedElement,
        model,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'AI command failed' }));
      throw new Error(err.error || err.detail || 'AI command failed');
    }
    return res.json();
  },

  async applyOperations(
    docId: string,
    operations: PDFOperation[],
    description?: string
  ): Promise<{ success: boolean; revision_number: number; analysis: DocumentAnalysis }> {
    const res = await fetch(`/api/documents/${docId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operations,
        description: description || 'AI úprava dokumentu',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Apply operations failed' }));
      throw new Error(err.error || err.detail || 'Apply operations failed');
    }
    return res.json();
  },

  async undo(docId: string): Promise<{ success: boolean; current_revision: number; analysis: DocumentAnalysis }> {
    const res = await fetch(`/api/documents/${docId}/undo`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Undo failed' }));
      throw new Error(err.error || err.detail || 'Undo failed');
    }
    return res.json();
  },

  async redo(docId: string): Promise<{ success: boolean; current_revision: number; analysis: DocumentAnalysis }> {
    const res = await fetch(`/api/documents/${docId}/redo`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Redo failed' }));
      throw new Error(err.error || err.detail || 'Redo failed');
    }
    return res.json();
  },

  async getHistory(docId: string): Promise<{
    history: RevisionInfo[];
    current_index: number;
    can_undo: boolean;
    can_redo: boolean;
  }> {
    const res = await fetch(`/api/documents/${docId}/history`);
    if (!res.ok) throw new Error('Failed to get history');
    return res.json();
  },

  async getOllamaStatus(): Promise<{ online: boolean; version?: string; url: string; error?: string }> {
    const res = await fetch('/api/ollama/status');
    return res.json();
  },

  async getOllamaModels(): Promise<{ models: Array<{ name: string; size?: number; family?: string }> }> {
    const res = await fetch('/api/ollama/models');
    return res.json();
  },

  async getSettings(): Promise<AppSettings> {
    const res = await fetch('/api/settings');
    return res.json();
  },

  async updateSettings(settings: AppSettings): Promise<{ status: string; settings: AppSettings }> {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  },
};
