import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ListWorkspace } from './list-workspace';

@Component({
  imports: [ListWorkspace],
  template: '<section appListWorkspace><div>Controls</div><table></table></section>',
})
class WorkspaceExample {}

describe('ListWorkspace', () => {
  it('owns the vertical spacing without adding a wrapper or a margin', async () => {
    const fixture = TestBed.createComponent(WorkspaceExample);
    await fixture.whenStable();
    const section = fixture.nativeElement.querySelector('section') as HTMLElement;
    expect(section.children).toHaveLength(2);
    expect(section.style.display).toBe('grid');
    expect(section.style.gap).toBe('var(--space-4)');
    expect(section.style.margin).toBe('');
  });
});
