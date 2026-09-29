import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

interface TransactionCreate {
  type: 'income' | 'expense';
  amount: string;
  category: string;
  description: string | null;
  transaction_date: string;
  currency: string;
}

interface TransactionResponse extends TransactionCreate {
  id: string;
  created_at: string;
}

interface DemoTransaction {
  title: string;
  category: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  icon: string;
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
export class App {
  private readonly formBuilder = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  protected readonly currencyCode = 'USD';
  protected readonly isSubmitting = signal(false);
  protected readonly feedback = signal<Feedback | null>(null);
  protected readonly savedTransaction = signal<TransactionResponse | null>(null);

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

  protected readonly demoTransactions: DemoTransaction[] = [
    {
      title: 'Whole Foods Market',
      category: 'Groceries',
      date: 'Today, 10:42 AM',
      amount: 68.42,
      type: 'expense',
      icon: 'W',
    },
    {
      title: 'Monthly salary',
      category: 'Income',
      date: 'Today, 8:15 AM',
      amount: 4250,
      type: 'income',
      icon: '↗',
    },
    {
      title: 'Blue Bottle Coffee',
      category: 'Dining',
      date: 'Yesterday',
      amount: 12.8,
      type: 'expense',
      icon: 'B',
    },
    {
      title: 'Electricity bill',
      category: 'Utilities',
      date: 'Sep 25, 2026',
      amount: 94.16,
      type: 'expense',
      icon: '⚡',
    },
  ];

  protected async submitTransaction(): Promise<void> {
    this.feedback.set(null);
    this.savedTransaction.set(null);

    if (this.transactionForm.invalid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    const formValue = this.transactionForm.getRawValue();
    const payload: TransactionCreate = {
      ...formValue,
      amount: formValue.amount.trim(),
      category: formValue.category.trim(),
      description: formValue.description.trim() || null,
    };

    this.isSubmitting.set(true);
    try {
      const response = await firstValueFrom(
        this.http.post<TransactionResponse>('/api/v1/transactions', payload),
      );
      this.savedTransaction.set(response);
      this.feedback.set({
        kind: 'success',
        message: 'Your transaction was saved to the database.',
      });
      this.transactionForm.reset({
        type: 'expense',
        amount: '',
        category: '',
        description: '',
        transaction_date: this.todayLocal(),
        currency: 'USD',
      });
    } catch (error: unknown) {
      const message =
        error instanceof HttpErrorResponse && error.status === 422
          ? 'Please review the transaction details and try again.'
          : 'We could not save your transaction. Check your connection and try again.';
      this.feedback.set({ kind: 'error', message });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private todayLocal(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
  }
}
