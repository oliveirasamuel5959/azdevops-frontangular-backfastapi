import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

interface TransactionPayload {
  type: 'income' | 'expense';
  amount: string;
  category: string;
  description: string | null;
  transaction_date: string;
  currency: string;
}

interface TransactionResponse extends TransactionPayload {
  id: string;
  created_at: string;
}

interface CategoryTotal {
  category: string;
  amount: number;
}

interface Feedback {
  kind: 'success' | 'error';
  message: string;
}

@Component({
  selector: 'app-root',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly currentMonthKey = this.todayLocal().slice(0, 7);

  protected readonly summaryCurrency = 'USD';
  protected readonly transactions = signal<TransactionResponse[]>([]);
  protected readonly isLoadingTransactions = signal(true);
  protected readonly transactionsError = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly isDeleting = signal<string | null>(null);
  protected readonly editingTransactionId = signal<string | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);
  protected readonly activityFeedback = signal<Feedback | null>(null);

  protected readonly netRecordedUsd = computed(() => {
    const cents = this.transactions()
      .filter((transaction) => transaction.currency === this.summaryCurrency)
      .reduce((total, transaction) => {
        const amount = this.toCents(transaction.amount);
        return total + (transaction.type === 'income' ? amount : -amount);
      }, 0);
    return cents / 100;
  });

  private readonly thisMonthUsdTransactions = computed(() =>
    this.transactions().filter(
      (transaction) =>
        transaction.currency === this.summaryCurrency &&
        transaction.transaction_date.startsWith(this.currentMonthKey),
    ),
  );

  protected readonly monthlyIncomeUsd = computed(
    () => this.sumCents(this.thisMonthUsdTransactions(), 'income') / 100,
  );
  protected readonly monthlyExpensesUsd = computed(
    () => this.sumCents(this.thisMonthUsdTransactions(), 'expense') / 100,
  );
  protected readonly monthlyExpenseCategories = computed(() => {
    const totals = new Map<string, number>();
    for (const transaction of this.thisMonthUsdTransactions()) {
      if (transaction.type === 'expense') {
        totals.set(
          transaction.category,
          (totals.get(transaction.category) ?? 0) + this.toCents(transaction.amount),
        );
      }
    }
    return [...totals.entries()]
      .map(([category, cents]): CategoryTotal => ({ category, amount: cents / 100 }))
      .sort((left, right) => right.amount - left.amount);
  });

  protected readonly transactionForm = this.formBuilder.nonNullable.group({
    type: this.formBuilder.nonNullable.control<'income' | 'expense'>('expense'),
    amount: [
      '',
      [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/), Validators.min(0.01)],
    ],
    category: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', Validators.maxLength(500)],
    transaction_date: [this.todayLocal(), Validators.required],
    currency: ['USD', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
  });

  ngOnInit(): void {
    void this.loadTransactions();
  }

  protected async loadTransactions(): Promise<void> {
    this.isLoadingTransactions.set(true);
    this.transactionsError.set(null);
    try {
      const transactions = await firstValueFrom(
        this.http.get<TransactionResponse[]>('/api/v1/transactions'),
      );
      this.transactions.set(this.sortTransactions(transactions));
    } catch {
      this.transactionsError.set('Transactions could not be loaded. Check your connection and retry.');
    } finally {
      this.isLoadingTransactions.set(false);
    }
  }

  protected async submitTransaction(): Promise<void> {
    this.feedback.set(null);
    if (this.transactionForm.invalid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    const formValue = this.transactionForm.getRawValue();
    const payload: TransactionPayload = {
      ...formValue,
      amount: formValue.amount.trim(),
      category: formValue.category.trim(),
      description: formValue.description.trim() || null,
    };
    const transactionId = this.editingTransactionId();

    this.isSubmitting.set(true);
    try {
      const request = transactionId
        ? this.http.put<TransactionResponse>(
            `/api/v1/transactions/${transactionId}`,
            payload,
          )
        : this.http.post<TransactionResponse>('/api/v1/transactions', payload);
      const saved = await firstValueFrom(request);
      this.transactions.update((current) => {
        const updated = transactionId
          ? current.map((transaction) => (transaction.id === saved.id ? saved : transaction))
          : [...current, saved];
        return this.sortTransactions(updated);
      });
      this.transactionsError.set(null);
      this.feedback.set({
        kind: 'success',
        message: transactionId
          ? 'Your transaction was updated.'
          : 'Your transaction was saved to the database.',
      });
      this.resetForm();
    } catch (error: unknown) {
      this.feedback.set({ kind: 'error', message: this.writeErrorMessage(error) });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected editTransaction(transaction: TransactionResponse): void {
    this.feedback.set(null);
    this.editingTransactionId.set(transaction.id);
    this.transactionForm.setValue({
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description ?? '',
      transaction_date: transaction.transaction_date,
      currency: transaction.currency,
    });
    this.transactionForm.markAsPristine();
  }

  protected cancelEditing(): void {
    this.resetForm();
  }

  protected async deleteTransaction(transaction: TransactionResponse): Promise<void> {
    if (this.isDeleting() !== null || this.isSubmitting()) {
      return;
    }

    this.activityFeedback.set(null);
    this.isDeleting.set(transaction.id);
    try {
      await firstValueFrom(
        this.http.delete<void>(`/api/v1/transactions/${transaction.id}`),
      );
      this.transactions.update((current) =>
        current.filter((item) => item.id !== transaction.id),
      );
      this.transactionsError.set(null);
      if (this.editingTransactionId() === transaction.id) {
        this.resetForm();
      }
      this.activityFeedback.set({ kind: 'success', message: 'Your transaction was deleted.' });
    } catch (error: unknown) {
      this.activityFeedback.set({ kind: 'error', message: this.writeErrorMessage(error) });
    } finally {
      this.isDeleting.set(null);
    }
  }

  private sumCents(
    transactions: TransactionResponse[],
    type: 'income' | 'expense',
  ): number {
    return transactions
      .filter((transaction) => transaction.type === type)
      .reduce((total, transaction) => total + this.toCents(transaction.amount), 0);
  }

  private toCents(amount: string): number {
    const [whole, fraction = ''] = amount.split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
  }

  private sortTransactions(transactions: TransactionResponse[]): TransactionResponse[] {
    return [...transactions].sort(
      (left, right) =>
        right.transaction_date.localeCompare(left.transaction_date) ||
        right.created_at.localeCompare(left.created_at),
    );
  }

  private writeErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 422) {
      return 'Please review the transaction details and try again.';
    }
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return 'This transaction no longer exists. Refresh the transaction list and try again.';
    }
    return 'We could not save your changes. Check your connection and try again.';
  }

  private resetForm(): void {
    this.editingTransactionId.set(null);
    this.transactionForm.reset({
      type: 'expense',
      amount: '',
      category: '',
      description: '',
      transaction_date: this.todayLocal(),
      currency: 'USD',
    });
  }

  private todayLocal(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
  }
}
