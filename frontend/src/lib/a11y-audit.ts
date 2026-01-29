/**
 * Accessibility audit utilities
 * Run this in development to check for common a11y issues
 */

export function checkAccessibility() {
  if (typeof window === 'undefined') return;

  const issues: string[] = [];

  // Check for missing alt attributes on images
  const images = document.querySelectorAll('img');
  images.forEach((img, index) => {
    if (!img.getAttribute('alt') && !img.getAttribute('aria-hidden')) {
      issues.push(`Image at index ${index} is missing alt attribute`);
    }
  });

  // Check for missing labels on form inputs
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach((input, index) => {
    const id = input.getAttribute('id');
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    const label = id ? document.querySelector(`label[for="${id}"]`) : null;

    if (!ariaLabel && !ariaLabelledBy && !label) {
      issues.push(`Input at index ${index} is missing label`);
    }
  });

  // Check for missing aria-labels on buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach((button, index) => {
    const text = button.textContent?.trim();
    const ariaLabel = button.getAttribute('aria-label');
    const ariaLabelledBy = button.getAttribute('aria-labelledby');

    if (!text && !ariaLabel && !ariaLabelledBy) {
      issues.push(`Button at index ${index} is missing accessible name`);
    }
  });

  // Check for color contrast (basic check)
  const elements = document.querySelectorAll('*');
  elements.forEach((el) => {
    const style = window.getComputedStyle(el);
    const color = style.color;
    const bgColor = style.backgroundColor;

    // This is a simplified check - use axe-core for proper contrast checking
    if (color === bgColor) {
      issues.push(`Element may have poor color contrast: ${el.tagName}`);
    }
  });

  if (issues.length > 0) {
    console.warn('Accessibility issues found:', issues);
    return issues;
  }

  console.log('No obvious accessibility issues found');
  return [];
}

// Run audit in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Run after page load
  if (document.readyState === 'complete') {
    setTimeout(checkAccessibility, 1000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(checkAccessibility, 1000);
    });
  }
}
