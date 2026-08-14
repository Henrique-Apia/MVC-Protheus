import { Routes } from '@angular/router';
import { Cns009 } from './cns009/cns009';
import { Home } from './home/home';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'inicio',
    pathMatch: 'full'
  },
  {
    path: 'inicio',
    component: Home
  },
  {
    path: 'cns009',
    component: Cns009
  },
  {
    path: '**',
    redirectTo: 'inicio'
  }
];
