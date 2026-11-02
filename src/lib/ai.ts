import { Equipment, CheckLog, Operator, TimeWindowSettings, ShiftNote } from "../types";

export interface AiChatPayload {
  prompt: string;
  reportType?: 'quality_summary' | 'shift_eval' | 'handover' | 'risk_analysis' | 'custom';
  contextData?: {
    selectedDate?: string;
    selectedShift?: string;
    equipments?: Partial<Equipment>[];
    recentLogs?: Partial<CheckLog>[];
    timeWindows?: TimeWindowSettings;
    operators?: Partial<Operator>[];
    shiftNotes?: ShiftNote[];
  };
}

export interface AiChatResponse {
  reply?: string;
  error?: string;
}

export async function askApexAi(payload: AiChatPayload): Promise<AiChatResponse> {
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return { reply: data.reply };
  } catch (err: any) {
    console.error('Error contacting AI service:', err);
    return {
      error: err.message || 'ไม่สามารถติดต่อ AI Server ได้ กรุณาลองใหม่อีกครั้ง'
    };
  }
}
