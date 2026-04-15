import { GoogleGenAI, Type } from '@google/genai';
import * as XLSX from 'xlsx';

// Initialize the Gemini SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedProduct {
  description: string;
  brand?: string;
  supplier?: string;
  unitOfMeasure: string;
  unitPrice: number;
  totalPrice: number;
  semanticTags?: string[];
}

export interface ExtractedQuotation {
  supplier: string;
  date: string; // ISO format
  quoteNumber: string;
  type: 'proposta' | 'pedido' | 'orçamento' | 'outro';
  products: ExtractedProduct[];
}

export const extractQuotationDataFromText = async (text: string): Promise<ExtractedQuotation> => {
  try {
    const parts = [
      {
        text: `Aqui está o texto de uma cotação/orçamento (geralmente copiado do WhatsApp ou email):\n\n${text}`
      },
      {
        text: `Você é um assistente de extração de dados de cotações, orçamentos e pedidos.
      Analise o texto acima e extraia as seguintes informações:
      - Fornecedor (nome da empresa principal que enviou a cotação, infira se não estiver explícito)
      - Data da cotação (formato YYYY-MM-DD. Se não houver, use a data de hoje)
      - Número da cotação/proposta/pedido (se não houver, crie um identificador como 'WHATSAPP')
      - Tipo (classifique como 'proposta', 'pedido', 'orçamento' ou 'outro')
      - Lista de produtos cotados. Para cada produto:
        - Descrição detalhada
        - Fornecedor (Atenção: se o texto tiver vários fornecedores, extraia o fornecedor específico deste item aqui. NÃO confunda fornecedor com marca)
        - Marca (se houver, senão deixe vazio. Não coloque o nome do fornecedor aqui)
        - Unidade de Medida (ex: UN, PC, KG, CX. Infira 'UN' se não houver)
        - Preço Unitário (número float, ex: 15.50)
        - Preço Total (número float, ex: 155.00. Se não houver, calcule baseado na quantidade se possível, ou repita o unitário)
        - Tags Semânticas (array de strings): Expanda abreviações e crie sinônimos para facilitar a busca. Exemplo: se a descrição for "CB UTP C6", as tags devem ser ["cabo", "rede", "utp", "cat6", "categoria 6", "par trançado"].
      
      Retorne APENAS um JSON válido seguindo estritamente o schema solicitado.`,
      }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts,
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            supplier: { type: Type.STRING, description: "Nome do fornecedor principal" },
            date: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
            quoteNumber: { type: Type.STRING, description: "Número do documento" },
            type: { type: Type.STRING, description: "Tipo do documento", enum: ["proposta", "pedido", "orçamento", "outro"] },
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  brand: { type: Type.STRING },
                  supplier: { type: Type.STRING },
                  unitOfMeasure: { type: Type.STRING },
                  unitPrice: { type: Type.NUMBER },
                  totalPrice: { type: Type.NUMBER },
                  semanticTags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["description", "unitOfMeasure", "unitPrice", "totalPrice"]
              }
            }
          },
          required: ["supplier", "date", "quoteNumber", "type", "products"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Resposta vazia da API");
    }

    const parsedData = JSON.parse(jsonText);
    return parsedData as ExtractedQuotation;
  } catch (error) {
    console.error("Erro ao extrair dados do texto:", error);
    throw new Error("Não foi possível extrair os dados do texto. Verifique se o formato é legível.");
  }
};

export const extractQuotationData = async (file: File): Promise<ExtractedQuotation> => {
  try {
    const mimeType = file.type;
    const parts: any[] = [];

    if (file.name.endsWith('.xlsx') || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      // Process Excel files locally and send as CSV text
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const csvText = XLSX.utils.sheet_to_csv(worksheet);
      
      parts.push({
        text: `Aqui estão os dados da planilha em formato CSV:\n\n${csvText}`
      });
    } else {
      // Convert other files (PDF, images) to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    parts.push({
      text: `Você é um assistente de extração de dados de cotações, orçamentos e pedidos.
      Analise o documento anexo e extraia as seguintes informações:
      - Fornecedor (nome da empresa principal que enviou a cotação)
      - Data da cotação (formato YYYY-MM-DD)
      - Número da cotação/proposta/pedido
      - Tipo (classifique como 'proposta', 'pedido', 'orçamento' ou 'outro')
      - Lista de produtos cotados. Para cada produto:
        - Descrição detalhada
        - Fornecedor (Atenção: se a planilha/documento for um mapa comparativo com vários fornecedores, extraia o fornecedor específico deste item aqui. NÃO confunda fornecedor com marca)
        - Marca (se houver, senão deixe vazio. Não coloque o nome do fornecedor aqui)
        - Unidade de Medida (ex: UN, PC, KG, CX)
        - Preço Unitário (número float, ex: 15.50)
        - Preço Total (número float, ex: 155.00)
        - Tags Semânticas (array de strings): Expanda abreviações e crie sinônimos para facilitar a busca. Exemplo: se a descrição for "CB UTP C6", as tags devem ser ["cabo", "rede", "utp", "cat6", "categoria 6", "par trançado"]. Se for "PARAF SEXT 1/4", as tags devem ser ["parafuso", "sextavado", "ferragem", "fixação"].
      
      Retorne APENAS um JSON válido seguindo estritamente o schema solicitado.`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts,
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            supplier: { type: Type.STRING, description: "Nome do fornecedor principal" },
            date: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
            quoteNumber: { type: Type.STRING, description: "Número do documento" },
            type: { type: Type.STRING, description: "Tipo do documento", enum: ["proposta", "pedido", "orçamento", "outro"] },
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  brand: { type: Type.STRING },
                  supplier: { type: Type.STRING, description: "Nome do fornecedor específico deste item, se houver múltiplos no documento." },
                  unitOfMeasure: { type: Type.STRING },
                  unitPrice: { type: Type.NUMBER },
                  totalPrice: { type: Type.NUMBER },
                  semanticTags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Palavras-chave, sinônimos e nomes por extenso para facilitar a busca."
                  }
                },
                required: ["description", "unitOfMeasure", "unitPrice", "totalPrice"]
              }
            }
          },
          required: ["supplier", "date", "quoteNumber", "type", "products"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("A IA não retornou dados.");
    
    // Remove markdown code blocks if the model accidentally includes them
    const cleanText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    
    return JSON.parse(cleanText) as ExtractedQuotation;
  } catch (error: any) {
    console.error("Erro ao extrair dados com Gemini:", error);
    throw new Error(`Falha ao processar o documento: ${error.message || 'Erro desconhecido'}`);
  }
};
