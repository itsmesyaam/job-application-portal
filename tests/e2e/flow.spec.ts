import { test, expect } from '@playwright/test';

test.describe('End-to-End Candidate Recruitment Pipeline', () => {
  test('should trace full application lifecycle from candidate submit to admin shortlist and final challenge submission', async ({ page }) => {
    // 1. Candidate lands on Career Page and authenticates via Simulated Dev Login
    await page.goto('http://localhost:3000/');
    await expect(page.locator('text=Join Our Team')).toBeVisible();
    
    const simulateBtn = page.locator('text=Simulate Demo Login');
    await expect(simulateBtn).toBeVisible();
    await simulateBtn.click();

    // 2. Candidate fills Step 2: Personal Details
    await expect(page.locator('text=Step 2: Personal Details')).toBeVisible();
    await page.fill('input[placeholder="+1 (555) 000-0000"]', '+15551234567');
    await page.fill('input[placeholder="https://myportfolio.com"]', 'https://github.com/janedoe');
    
    // Handle File Chooser upload event
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Upload PDF or DOCX file');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock pdf document content'),
    });
    
    await page.click('text=Proceed to Step 3');

    // 3. Candidate fills Step 3: Position & Experience
    await expect(page.locator('text=Step 3: Position details')).toBeVisible();
    await page.selectOption('select', 'FULL_STACK_DEVELOPER');
    await page.fill('input[type="number"]', '4');
    await page.fill('textarea', 'Highly passionate full-stack developer with React & Node experience.');
    
    // Submit Application
    await page.click('button:has-text("Submit Application")');
    
    // 4. Verify Toast notification of successful application
    await expect(page.locator('text=Application submitted successfully')).toBeVisible();

    // 5. Admin Dashboard reviews and assigns task
    await page.goto('http://localhost:3000/admin/dashboard');
    await expect(page.locator('text=Admin Portal')).toBeVisible();

    // Click candidate row to inspect
    await page.locator('text=Jane Doe').first().click();

    // Open Take-home Task Tab
    await page.click('text=Take-home Task');
    await page.fill('input[placeholder="e.g. Build a Responsive SaaS Landing Page"]', 'Acme SaaS Integration Challenge');
    await page.fill('textarea[placeholder*="Detail task requirements"]', 'Build a Next.js server actions form database sync pipeline.');
    await page.click('text=Shortlist & Assign Challenge');

    // Verify status changed to Shortlisted
    await expect(page.locator('text=SHORTLISTED').first()).toBeVisible();

    // 6. Candidate accesses Dashboard and views countdown timer
    await page.goto('http://localhost:3000/dashboard');
    await expect(page.locator('text=Acme SaaS Integration Challenge')).toBeVisible();
    await expect(page.locator('text=Time Remaining')).toBeVisible();

    // 7. Candidate submits take-home challenge deliverables
    await page.fill('input[placeholder="https://github.com/..."]', 'https://github.com/janedoe/acme-saas-integration');
    await page.fill('textarea[id="notes"]', 'Completed all required server actions and database mappings.');
    await page.click('text=Submit Challenge');

    // Verify task status is now Submitted
    await expect(page.locator('text=Submitted & Under Review')).toBeVisible();
  });
});
