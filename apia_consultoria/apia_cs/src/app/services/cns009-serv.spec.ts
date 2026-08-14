import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Cns009Serv } from './cns009-serv';

describe('Cns009Serv', () => {
  let service: Cns009Serv;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(Cns009Serv);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
