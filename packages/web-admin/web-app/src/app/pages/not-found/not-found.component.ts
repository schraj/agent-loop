import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  styles: [`
    .not-found {
      text-align: center;
      padding: 4rem 0;
    }
    h1 {
      font-size: 4rem;
      color: var(--color-gray-300);
      margin: 0;
    }
    p {
      color: var(--color-gray-500);
      margin: 0.5rem 0 1.5rem;
    }
    a {
      color: var(--color-primary);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  `]
})
export class NotFoundComponent {}
