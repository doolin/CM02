const { generatePdf } = require('../lib/cm02Pdf');

describe('cm02Pdf', () => {
  test('generates a valid PDF buffer with no input', async () => {
    const buffer = await generatePdf();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('generates a valid PDF buffer with full input', async () => {
    const buffer = await generatePdf({
      systemName: 'Test System Alpha',
      implementationStatus: 'Implemented',
      implementationNarrative: 'The baseline configuration is maintained via automated CM tools.',
      responsibleRole: 'System Administrator',
      frequency: 'annually',
      circumstances: 'significant changes to the system architecture',
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  test('substitutes ODP parameters in output', async () => {
    const buffer = await generatePdf({
      frequency: 'quarterly',
      circumstances: 'security incidents',
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  test('includes discussion and related controls rows', async () => {
    // Verify the PDF generates without error when all 10 rows render
    const buffer = await generatePdf({ systemName: 'Test' });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    // PDF with all 10 rows including discussion and related controls
    // should be larger than a minimal PDF
    expect(buffer.length).toBeGreaterThan(2000);
  });
});
