import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

// @ts-ignore - pdf-parse has ESM/CJS interop issues
import pdf from 'pdf-parse';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/csv',
  'text/plain'
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export interface FileProcessingResult {
  success: boolean;
  extractedText?: string;
  error?: string;
  isImage?: boolean;
  base64Data?: string;
}

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

export function isFileSizeValid(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export async function processFile(filePath: string, mimeType: string): Promise<FileProcessingResult> {
  try {
    if (isImageFile(mimeType)) {
      const imageBuffer = fs.readFileSync(filePath);
      const base64Data = imageBuffer.toString('base64');
      return {
        success: true,
        isImage: true,
        base64Data,
        extractedText: `[Image file: ${path.basename(filePath)}]`
      };
    }

    if (mimeType === 'application/pdf') {
      return await processPdf(filePath);
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel' ||
        mimeType === 'text/csv') {
      return await processExcel(filePath);
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword') {
      return await processWord(filePath);
    }

    if (mimeType === 'text/plain') {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        success: true,
        extractedText: content.substring(0, 50000)
      };
    }

    return {
      success: false,
      error: `Unsupported file type: ${mimeType}`
    };
  } catch (error) {
    console.error('File processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error processing file'
    };
  }
}

async function processPdf(filePath: string): Promise<FileProcessingResult> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    
    const extractedText = data.text.substring(0, 50000);
    
    return {
      success: true,
      extractedText: `PDF Document (${data.numpages} pages):\n\n${extractedText}`
    };
  } catch (error) {
    console.error('PDF processing error:', error);
    return {
      success: false,
      error: 'Failed to process PDF file'
    };
  }
}

async function processExcel(filePath: string): Promise<FileProcessingResult> {
  try {
    const workbook = XLSX.readFile(filePath);
    const results: string[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      results.push(`Sheet: ${sheetName}`);
      results.push('-'.repeat(40));
      
      const rows = jsonData.slice(0, 100) as any[][];
      for (const row of rows) {
        if (row && row.length > 0) {
          results.push(row.map(cell => String(cell ?? '')).join('\t'));
        }
      }
      
      if (jsonData.length > 100) {
        results.push(`... and ${jsonData.length - 100} more rows`);
      }
      
      results.push('');
    }
    
    const extractedText = results.join('\n').substring(0, 50000);
    
    return {
      success: true,
      extractedText: `Excel/CSV Document:\n\n${extractedText}`
    };
  } catch (error) {
    console.error('Excel processing error:', error);
    return {
      success: false,
      error: 'Failed to process Excel/CSV file'
    };
  }
}

async function processWord(filePath: string): Promise<FileProcessingResult> {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    
    const extractedText = result.value.substring(0, 50000);
    
    return {
      success: true,
      extractedText: `Word Document:\n\n${extractedText}`
    };
  } catch (error) {
    console.error('Word processing error:', error);
    return {
      success: false,
      error: 'Failed to process Word document'
    };
  }
}

export function getFileTypeDescription(mimeType: string): string {
  const types: Record<string, string> = {
    'image/jpeg': 'JPEG Image',
    'image/png': 'PNG Image',
    'image/gif': 'GIF Image',
    'image/webp': 'WebP Image',
    'application/pdf': 'PDF Document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
    'application/vnd.ms-excel': 'Excel Spreadsheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'application/msword': 'Word Document',
    'text/csv': 'CSV File',
    'text/plain': 'Text File'
  };
  
  return types[mimeType] || 'Unknown File';
}
