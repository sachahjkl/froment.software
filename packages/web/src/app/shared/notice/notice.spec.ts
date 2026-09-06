import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Notice } from './notice';

@Component({
  imports: [Notice],
  template:
    '<p appNotice variant="success">Saved</p><div appNotice variant="danger" role="alert"><p>Failed</p><button type="button">Retry</button></div>',
})
class NoticeHost {}

describe('Notice', () => {
  it('styles paragraph and structured notices through the same component', async () => {
    const fixture = TestBed.createComponent(NoticeHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('p.notice.success')?.textContent).toBe('Saved');
    expect(root.querySelector('div.notice.danger[role="alert"] button')?.textContent).toBe('Retry');
  });
});
