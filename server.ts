import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// System Persona for Industrial Quality & Shift Team Management
const SYSTEM_INSTRUCTION = `คุณคือ "Apex AI Inspector & Operations Intelligence" ผู้ช่วยอัจฉริยะประจำระบบตรวจเช็กเครื่องจักรห้องแล็บและโรงงานอุตสาหกรรม (Laboratory & Industrial Equipment Compliance System)

หน้าที่และความเชี่ยวชาญหลักของคุณคือ:
1. การควบคุมคุณภาพ (Quality Control & Compliance):
   - วิเคราะห์ความครอบคลุมของการตรวจเช็ก (Inspection Coverage Rate)
   - วิเคราะห์ค่าพารามิเตอร์ที่ผิดปกติ (Out-of-Control / OOC) และจุดเสี่ยงที่มีแนวโน้มกระทบต่อคุณภาพงานทดสอบ/การผลิต
   - ตรวจจับเครื่องจักรที่ตรวจไม่ผ่านบ่อยหรือค้างตรวจบ่อย
2. การประเมินความรับผิดชอบ วินัย และการดูแลทีมงานภายในกะ (Shift Performance & Team Evaluation):
   - ประเมินผลงานของหัวหน้ากะ (Shift Leader) และพนักงานประจำกะ (Team Members) ในแต่ละวัน/รอบ
   - ตรวจสอบความตรงต่อเวลา (Time-window Discipline): ตรวจเช็กภายในเกณฑ์เวลาที่กำหนดหรือไม่ (เช่น กะเช้า 08:00-10:00, กะดึก 19:00-22:00) หรือตรวจช้า (Late)
   - ตรวจสอบความละเอียดรอบคอบ: การลงบันทึกหมายเหตุ ปัญหาหน้างาน หรือการแจ้งเตือน
   - ให้คะแนน/เกรดผลงาน (เช่น A, B, C) อย่างเป็นธรรม สมเหตุสมผล พร้อมข้อเสนอแนะเชิงบวกเพื่อการพัฒนา
3. การจดจำและบันทึกข้อมูลสำคัญ (Memory & Handover):
   - นำคำสั่งการ/ข้อสั่งการของผู้บริหาร ข้อกำหนดพิเศษ หรือบันทึกส่งมอบงานระหว่างกะ มาพิจารณาร่วมด้วยเสมอ
4. การสร้างรายงานสำหรับผู้บริหารและหัวหน้างาน (Executive Reporting):
   - ใช้ภาษาไทยที่เป็นทางการ เข้าใจง่าย ชัดเจน มีโครงสร้างเป็นระเบียบ
   - มีหัวข้อ สัญลักษณ์ Emoji ที่เหมาะสม ตัวเลขสถิติที่ชัดเจน (KPI Metrics) และบทสรุปข้อสั่งการ Action Items`;

// API: AI Chat & Report Generation
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt, reportType, contextData, history } = req.body;

    if (!prompt && !reportType) {
      return res.status(400).json({ error: 'Prompt or reportType is required' });
    }

    if (!ai) {
      return res.status(500).json({ 
        error: 'ระบบยังไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาตรวจสอบ Settings > Secrets' 
      });
    }

    // Prepare contextual prompt with operational data
    const contextPrompt = `
[บริบทข้อมูลระบบปัจจุบัน]
- วันที่และเวลาปัจจุบัน: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
- ข้อมูลเกณฑ์เวลา (Time Windows): ${JSON.stringify(contextData?.timeWindows || {})}
- ข้อมูลทีมงาน/กะ (Operators): ${JSON.stringify(contextData?.operators || [])}
- รายการบันทึกข้อสั่งการ/สิ่งที่จดจำไว้ (Directives & Shift Notes): ${JSON.stringify(contextData?.shiftNotes || [])}
- สรุปสถานะเครื่องจักร (Equipments Summary): ${JSON.stringify(contextData?.equipments || [])}
- ข้อมูลบันทึกการตรวจเช็กและค่าผิดปกติ (Recent Check Logs & Anomalies): ${JSON.stringify(contextData?.recentLogs || [])}

[คำขอจากผู้ใช้/ประเภทรายงาน]
- ประเภทรายงาน: ${reportType || 'การถามตอบทั่วไป'}
- คำสั่ง/คำถาม: ${prompt || 'กรุณาสรุปรายงานภาพรวม'}
`;

    const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let lastError: any = null;
    let reply = '';

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: contextPrompt }],
            },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.3,
          },
        });

        if (response && response.text) {
          reply = response.text;
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} failed, trying next candidate...`, err?.message);
        lastError = err;
        // Short pause before next attempt
        await new Promise(r => setTimeout(r, 600));
      }
    }

    if (!reply && lastError) {
      throw lastError;
    }

    return res.json({ reply: reply || 'ไม่สามารถประมวลผลข้อความได้ในขณะนี้' });
  } catch (error: any) {
    console.error('Error generating AI response:', error);
    let errorMsg = error?.message || 'เกิดข้อผิดพลาดในการประมวลผลด้วย AI';
    try {
      const parsed = JSON.parse(errorMsg);
      if (parsed?.error?.message) {
        errorMsg = parsed.error.message;
      }
    } catch (_) {}
    return res.status(500).json({ error: errorMsg });
  }
});

// Setup Vite middlewares in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
