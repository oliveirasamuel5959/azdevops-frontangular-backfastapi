import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('renders the dashboard mock data and transaction form', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const rendered = fixture.nativeElement as HTMLElement;

    expect(rendered.querySelector('h1')?.textContent).toContain('Good morning, Jamie');
    expect(rendered.querySelectorAll('.activity-row').length).toBe(4);
    expect(rendered.querySelector('#new-transaction-title')?.textContent).toContain('Add a transaction');
  });

  it('shows required-field errors and does not submit an invalid form', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.submit-button')?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Enter an amount greater than zero');
    expect(fixture.nativeElement.textContent).toContain('Enter a category to continue');
    httpTesting.expectNone('/api/v1/transactions');
  });

  it('posts valid data and shows confirmation only after the API succeeds', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    setInput(root, '#amount', '18.25');
    setInput(root, '#category', '  Books  ');
    setInput(root, '#description', '  New notebook  ');
    root.querySelector<HTMLButtonElement>('.submit-button')?.click();
    fixture.detectChanges();

    const request = httpTesting.expectOne('/api/v1/transactions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({
      type: 'expense',
      amount: '18.25',
      category: 'Books',
      description: 'New notebook',
      currency: 'USD',
    });
    expect(root.textContent).not.toContain('Your transaction was saved');

    request.flush({
      id: '7ec46be3-48c2-4acb-9ddc-3940276021dc',
      type: 'expense',
      amount: '18.25',
      category: 'Books',
      description: 'New notebook',
      transaction_date: new Date().toISOString().slice(0, 10),
      currency: 'USD',
      created_at: new Date().toISOString(),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('Your transaction was saved to the database.');
    expect(root.textContent).toContain('Books');
  });

  it('shows an actionable message when the API rejects the write', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    setInput(root, '#amount', '10.00');
    setInput(root, '#category', 'Dining');
    root.querySelector<HTMLButtonElement>('.submit-button')?.click();

    httpTesting.expectOne('/api/v1/transactions').flush(
      { detail: 'Invalid request' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('Please review the transaction details and try again.');
    expect(root.textContent).not.toContain('Your transaction was saved');
  });
});

function setInput(root: HTMLElement, selector: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(selector);
  if (!input) {
    throw new Error(`Input ${selector} was not rendered`);
  }
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
