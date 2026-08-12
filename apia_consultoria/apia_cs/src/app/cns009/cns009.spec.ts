import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Cns009 } from './cns009';

describe('Cns009', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cns009],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Cns009);
    fixture.detectChanges();

    const component = fixture.componentInstance;

    expect(component).toBeTruthy();
  });
});
