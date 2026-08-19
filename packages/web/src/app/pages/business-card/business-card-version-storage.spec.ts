import { TestBed } from '@angular/core/testing';
import { BusinessCardVersion, BusinessCardVersionStorage } from './business-card-version-storage';

const key = 'froment-software.business-card.versions';
const version: BusinessCardVersion = {
  id: 'one',
  name: 'Version one',
  createdAt: '2026-08-19T12:00:00.000Z',
  content: {
    name: 'Sacha',
    role: 'Engineer',
    email: 'a@b.test',
    website: 'example.test',
    brandName: 'Brand',
  },
};

describe('BusinessCardVersionStorage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('loads valid entries and ignores invalid entries', () => {
    localStorage.setItem(key, JSON.stringify([version, { id: 1 }]));
    TestBed.configureTestingModule({ providers: [BusinessCardVersionStorage] });
    expect(TestBed.inject(BusinessCardVersionStorage).versions()).toEqual([version]);
  });

  it('keeps its signal unchanged when storage rejects a write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    TestBed.configureTestingModule({ providers: [BusinessCardVersionStorage] });
    const storage = TestBed.inject(BusinessCardVersionStorage);
    expect(storage.save(version)).toBe(false);
    expect(storage.versions()).toEqual([]);
  });
});
