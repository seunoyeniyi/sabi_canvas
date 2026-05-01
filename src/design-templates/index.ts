import type { DesignTemplate, TemplateCategory } from '@sabi-canvas/types/design-templates';
import presentationSlide from './presentation-slide.json';
import specialBurger from './special-burger.json';
import houseForSale from './house-for-sale.json';
import waffleOclock from './waffle-oclock.json';
import specialMneu from './special-menu.json';

export const DESIGN_TEMPLATES: DesignTemplate[] = [
    // socialMediaPost as unknown as DesignTemplate,
    { ...(presentationSlide as unknown as DesignTemplate), id: 'presentation-slide' },
    { ...(specialBurger as unknown as DesignTemplate), id: 'special-burger' },
    { ...(houseForSale as unknown as DesignTemplate), id: 'house-for-sale' },
    { ...(waffleOclock as unknown as DesignTemplate), id: 'waffle-oclock' },
    { ...(specialMneu as unknown as DesignTemplate), id: 'special-menu' },
];

export interface TemplateCategoryItem {
    id: 'all' | TemplateCategory;
    label: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategoryItem[] = [
    { id: 'all', label: 'All' },
    { id: 'social', label: 'Social' },
    { id: 'presentation', label: 'Presentation' },
    { id: 'marketing', label: 'Marketing' },
];
