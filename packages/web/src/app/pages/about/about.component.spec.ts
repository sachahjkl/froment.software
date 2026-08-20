import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '@app/i18n.service';
import { AboutComponent } from './about.component';

function textFrom(root: HTMLElement, selector: string): string[] {
  const elements = root.querySelectorAll(selector);
  return Array.from(elements, (element) => element.textContent?.trim() ?? '');
}

describe('AboutComponent FAQ', () => {
  let fixture: ComponentFixture<AboutComponent>;
  let i18n: I18nService;
  let element: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [AboutComponent] }).compileComponents();
    i18n = TestBed.inject(I18nService);
    i18n.setLanguage('fr');
    fixture = TestBed.createComponent(AboutComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('renders eight translated question and answer pairs and updates both live', () => {
    const frenchQuestions = textFrom(element, '.faq-item summary > span:first-child');
    const frenchAnswers = textFrom(element, '.faq-answer p');

    expect(frenchQuestions).toHaveLength(8);
    expect(frenchAnswers).toHaveLength(8);
    expect(frenchQuestions.every(Boolean)).toBe(true);
    expect(frenchAnswers.every(Boolean)).toBe(true);

    i18n.setLanguage('en');
    fixture.detectChanges();

    const englishQuestions = textFrom(element, '.faq-item summary > span:first-child');
    const englishAnswers = textFrom(element, '.faq-answer p');

    expect(englishQuestions).toHaveLength(8);
    expect(englishAnswers).toHaveLength(8);
    expect(englishQuestions.every((question, index) => question !== frenchQuestions[index])).toBe(
      true,
    );
    expect(englishAnswers.every((answer, index) => answer !== frenchAnswers[index])).toBe(true);
  });
});
