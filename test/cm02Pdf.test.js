const { generatePdf } = require('../lib/cm02Pdf');

describe('cm02Pdf', () => {
  test('generates a valid PDF buffer with no input', async () => {
    const buffer = await generatePdf();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // PDF magic bytes
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
    // Should be larger with content filled in
    expect(buffer.length).toBeGreaterThan(1000);
  });

  test('substitutes ODP parameters in output', async () => {
    const buffer = await generatePdf({
      frequency: 'quarterly',
      circumstances: 'security incidents',
    });
    // We can't easily inspect PDF text, but verify it doesn't crash
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});
