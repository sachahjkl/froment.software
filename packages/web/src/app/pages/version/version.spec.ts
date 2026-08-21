import { TestBed } from '@angular/core/testing';

import { Version } from './version';
import { VersionApi } from './version-api';

describe('Version', () => {
  it('displays the exact commit and all package versions', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: VersionApi,
          useValue: {
            get: () =>
              Promise.resolve({
                commit: '6c9757782e249d4db6ffb804349b7da620494565',
                packages: [
                  { name: '@froment/api', version: '0.1.0' },
                  { name: '@froment/web', version: '0.1.0' },
                ],
              }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Version);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const content = root.textContent;

    expect(content).toContain('6c9757782e249d4db6ffb804349b7da620494565');
    expect(content).toContain('@froment/api');
    expect(content).toContain('@froment/web');
    expect(content).not.toContain('Date de construction');
  });
});
