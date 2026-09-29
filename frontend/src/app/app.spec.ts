import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: string;
  category: string;
  description: string | null;
  transaction_date: string;
  currency: string;
  created_at: string;
}

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

  it('loads saved transactions and shows live empty-state totals when there are no records', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const listRequest = httpTesting.expectOne('/api/v1/transactions');
    expect(listRequest.request.method).toBe('GET');
    listRequest.flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.nativeElement as HTMLElement;
    expect(rendered.querySelector('h1')?.textContent).toContain('Your finances');
    expect(rendered.textContent).toContain('No transactions yet');
    expect(rendered.textContent).toContain('$0.00');
    expect(rendered.textContent).not.toContain('MOCK DATA');
    expect(rendered.textContent).not.toContain('Whole Foods Market');
    expect(rendered.querySelectorAll('.activity-row').length).toBe(0);
  });

  it('calculates USD summaries from persisted records without combining currencies', async () => {
    const fixture = TestBed.createComponent(App);
    const today = new Date();
    const monthDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    loadList(fixture, [
      transaction({ type: 'income', amount: '50.00', category: 'Pay', transaction_date: monthDate }),
      transaction({ amount: '10.25', category: 'Food', transaction_date: monthDate }),
      transaction({ amount: '999.00', category: 'Travel', currency: 'EUR', transaction_date: monthDate }),
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const amounts = Array.from(root.querySelectorAll('.summary-amount')).map((item) => item.textContent?.trim());
    expect(amounts).toEqual(['$39.75', '$50.00', '$10.25']);
    const categories = Array.from(root.querySelectorAll('.category-row')).map((item) => item.textContent);
    expect(categories).toHaveLength(1);
    expect(categories[0]).toContain('Food');
    expect(categories[0]).not.toContain('Travel');
  });

  it('shows required-field errors and does not submit an invalid form', async () => {
    const fixture = TestBed.createComponent(App);
    loadList(fixture, []);
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.submit-button')?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Enter an amount greater than zero');
    expect(fixture.nativeElement.textContent).toContain('Enter a category to continue');
    httpTesting.expectNone((request) => request.method === 'POST');
  });

  it('posts valid data and immediately adds the API response to the dashboard', async () => {
    const fixture = TestBed.createComponent(App);
    loadList(fixture, []);
    await fixture.whenStable();
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

    request.flush(transaction({ category: 'Books', amount: '18.25', description: 'New notebook' }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('Your transaction was saved to the database.');
    expect(root.textContent).toContain('Books');
    expect(root.querySelectorAll('.activity-row').length).toBe(1);
  });

  it('shows an actionable message when the API rejects a write', async () => {
    const fixture = TestBed.createComponent(App);
    loadList(fixture, []);
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    setInput(root, '#amount', '10.00');
    setInput(root, '#category', 'Dining');
    root.querySelector<HTMLButtonElement>('.submit-button')?.click();

    httpTesting.expectOne({ method: 'POST', url: '/api/v1/transactions' }).flush(
      { detail: 'Invalid request' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('Please review the transaction details and try again.');
    expect(root.textContent).not.toContain('Your transaction was saved');
  });

  it('edits a saved transaction with PUT and updates the displayed row', async () => {
    const fixture = TestBed.createComponent(App);
    loadList(fixture, [transaction()]);
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('[aria-label="Edit Groceries transaction"]')?.click();
    fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('#category')?.value).toBe('Groceries');
    expect(root.querySelector('#new-transaction-title')?.textContent).toContain('Edit transaction');
    setInput(root, '#category', 'Market');

    root.querySelector<HTMLButtonElement>('.submit-button')?.click();
    const request = httpTesting.expectOne(`/api/v1/transactions/${transaction().id}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.category).toBe('Market');
    request.flush(transaction({ category: 'Market' }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('Your transaction was updated.');
    expect(root.querySelector('.activity-name strong')?.textContent).toBe('Market');
  });

  it('deletes a saved transaction and removes it from the dashboard after success', async () => {
    const fixture = TestBed.createComponent(App);
    loadList(fixture, [transaction()]);
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('[aria-label="Delete Groceries transaction"]')?.click();
    const request = httpTesting.expectOne(`/api/v1/transactions/${transaction().id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelectorAll('.activity-row').length).toBe(0);
    expect(root.textContent).toContain('Your transaction was deleted.');
    expect(root.textContent).toContain('No transactions yet');
  });

  it('offers a retry when loading transactions fails', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/transactions').flush(
      { detail: 'Unavailable' },
      { status: 503, statusText: 'Unavailable' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Transactions could not be loaded');
    expect(
      Array.from(root.querySelectorAll('.summary-amount')).every(
        (item) => item.textContent?.trim() === '—',
      ),
    ).toBe(true);
    root.querySelector<HTMLButtonElement>('.activity-error button')?.click();
    const retry = httpTesting.expectOne('/api/v1/transactions');
    retry.flush([transaction()]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelectorAll('.activity-row').length).toBe(1);
    expect(root.textContent).toContain('Groceries');
  });
});

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: '7ec46be3-48c2-4acb-9ddc-3940276021dc',
    type: 'expense',
    amount: '18.25',
    category: 'Groceries',
    description: 'Weekly shop',
    transaction_date: '2026-09-28',
    currency: 'USD',
    created_at: '2026-09-28T10:00:00Z',
    ...overrides,
  };
}

function loadList(fixture: ComponentFixture<App>, items: Transaction[]): void {
  fixture.detectChanges();
  const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/transactions');
  expect(request.request.method).toBe('GET');
  request.flush(items);
}

function setInput(root: HTMLElement, selector: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(selector);
  if (!input) {
    throw new Error(`Input ${selector} was not rendered`);
  }
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
