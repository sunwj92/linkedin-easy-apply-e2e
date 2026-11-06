/** In-memory resume fixtures: no binary files need to live in the repo. */

export interface UploadFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

const PDF_HEADER = Buffer.from('%PDF-1.4\n% Easy Apply test fixture\n');

export function pdfResume(name = 'alice-chen-resume.pdf'): UploadFile {
  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.concat([PDF_HEADER, Buffer.from('1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n')]),
  };
}

export function docxResume(name = 'alice-chen-resume.docx'): UploadFile {
  return {
    name,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from('PK\u0003\u0004 fixture docx payload'),
  };
}

export function executableFile(name = 'resume.exe'): UploadFile {
  return {
    name,
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('MZ\u0000\u0000 fixture executable'),
  };
}

/** 2.5 MB PDF — above the 2 MB limit enforced by the fixture form. */
export function oversizedPdf(name = 'huge-resume.pdf'): UploadFile {
  const size = 2.5 * 1024 * 1024;
  const buffer = Buffer.alloc(size, 0x20);
  PDF_HEADER.copy(buffer, 0);
  return { name, mimeType: 'application/pdf', buffer };
}
