import type { OnboardingSlide } from '@/types';
import { photo } from './media';

/**
 * First-visit introduction.
 *
 * This is where the homepage used to end: a long value strip, an ingredient
 * explainer, and a founding story. Those sections were taking up most of the
 * first screen of scroll, and most first-time visitors never read them. They
 * are now a short, dismissible sequence shown once.
 *
 * The seed wording — including the four principles that used to head the
 * "How we work" strip — is content, not code. The admin can rewrite, reorder,
 * hide, or delete every slide, and can switch the whole sequence off. Nothing
 * here is a claim about clinical results, customers, or reviews.
 */
export const onboardingSlides: OnboardingSlide[] = [
  {
    id: 'ob-welcome',
    position: 1,
    enabled: true,
    icon: 'leaf',
    eyebrow: 'Welcome',
    title: 'Clinical skincare, quietly considered',
    body: 'We make a short range of products for people who would rather understand a formula than be persuaded by one. Every active is listed with the concentration it is used at, and every product page shows the full ingredient list.',
    ctaLabel: 'Start shopping',
    ctaHref: '/shop',
  },
  {
    id: 'ob-evidence',
    position: 2,
    enabled: true,
    icon: 'flask',
    eyebrow: 'Our standard',
    title: 'We publish the evidence, including the weak parts',
    body: 'Where a study measured a modest improvement we say modest, and where we hold a position we cannot fully defend we say that too. You are entitled to disagree, and we would rather you had the information than the reassurance.',
  },
  {
    id: 'ob-fewer-actives',
    position: 3,
    enabled: true,
    icon: 'sparkle',
    eyebrow: 'Principle one',
    title: 'Fewer actives, used properly',
    body: 'One active at a time, applied to clean skin, and given a full minute to absorb. Two actives used together is the most common cause of a damaged barrier we see.',
  },
  {
    id: 'ob-no-fear',
    position: 4,
    enabled: true,
    icon: 'shield',
    eyebrow: 'Principle two',
    title: 'We do not manufacture fear',
    body: 'No ingredient is presented as a threat. Silicones are among the most over-criticised ingredients in this category, and they are not a problem.',
  },
  {
    id: 'ob-short-list',
    position: 5,
    enabled: true,
    icon: 'droplet',
    eyebrow: 'Principle three',
    title: 'A short ingredient list',
    body: 'Nine ingredients at most, and a hard time going over. Every one has to earn its place, which usually means ruling out a handful that would have been easier to add.',
  },
  {
    id: 'ob-returns',
    position: 6,
    enabled: true,
    icon: 'truck',
    eyebrow: 'Principle four',
    title: 'Thirty days, opened or not',
    body: 'If a formula does not suit your skin, send it back within the return window and we refund it. Patch testing first is still the sensible approach, particularly with retinoids and acids.',
    image: photo(7691112, 'Minimalist arrangement of skincare products on a light surface'),
  },
];
