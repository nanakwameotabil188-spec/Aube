import type { ContentPage, FaqItem, JournalPost, Testimonial } from '@/types';
import { photo } from './media';

/**
 * Editorial content.
 *
 * Long-form copy, support copy and social proof are all records. A CMS or
 * an admin panel can replace this module without a component changing.
 */

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

export const journalPosts: JournalPost[] = [
  {
    id: 'post-01',
    slug: 'the-four-step-routine',
    title: 'The four-step routine, and why four is the number',
    excerpt:
      'Most routines are longer than they need to be. A cleanser, a treatment, a moisturiser and SPF is a complete, defensible system — and the discipline to do it daily matters more than anything you add.',
    category: 'skin-school',
    author: 'Dr. Iris Halloran',
    readingTimeMinutes: 7,
    publishedAt: '2026-08-12T09:00:00.000Z',
    image: photo(7691164, 'Clean display of skincare products on a white surface with a towel backdrop'),
    tags: ['Routine', 'Beginners', 'Skin school'],
    featured: true,
  productIds: ['prod-softening-milk-cleanser', 'prod-hydrating-essence', 'prod-barrier-serum', 'prod-daily-spf-50'],
    position: 1,
    status: 'active',
    visible: true,
    seo: {
      title: 'The four-step routine, explained',
      description: 'Why a four-step skincare routine beats a ten-step one, and how to order it.',
      canonicalPath: '/journal/the-four-step-routine',
    },
    createdAt: '2026-08-12T09:00:00.000Z',
    updatedAt: '2026-08-12T09:00:00.000Z',
    body: [
      {
        id: 's1',
        body: 'There is a particular kind of skincare advice that treats a longer routine as a better one. Nine steps, a diagram with arrows, and an unshakeable implication that your skin is underperforming because you have not purchased enough products.\n\nThis is not how skin works, and it is worth saying plainly: a routine you will perform every day for a year beats an ambitious one you abandon in a month. Consistency compounds. Complexity does not.',
      },
      {
        id: 's2',
        heading: 'What the four steps actually are',
        body: 'Cleansing removes what is on the skin. Treatment does the work. Moisturising keeps the result in place. Sunscreen prevents the damage that undoes all of it.\n\nEverything else is optional or, more honestly, optional for most people. Essences, oils, masks and serums are all useful. None of them is load-bearing.',
        list: [
          'Cleanse — remove sunscreen, makeup and overnight sebum.',
          'Treat — one active, applied to clean skin, allowed to absorb.',
          'Moisturise — humectants, emollients and occlusives in proportion to your skin type.',
          'Protect — broad-spectrum SPF, every morning, rain or shine.',
        ],
      },
      {
        id: 's3',
        heading: 'Why SPF is not optional',
        body: 'Roughly 80% of what we call facial ageing is photoageing. Ultraviolet light breaks down collagen and elastin directly, and it is cumulative and irreversible. No serum on any shelf reverses that.\n\nA sunscreen is a preventive measure, which makes it the least satisfying purchase in the category and by far the most consequential. If you adopt exactly one habit from this page, make it that one.',
        pullQuote:
          'Roughly 80% of what we call facial ageing is photoageing, and no serum reverses it.',
      },
      {
        id: 's4',
        heading: 'What to add, and when',
        body: 'Start at four steps for eight weeks. Not two weeks — eight, because skin turns over on a cycle measured in weeks and anything shorter produces noise rather than signal.\n\nAfter two months, if one of your concerns is unresolved, add the single product that addresses it. One. Then another eight weeks before reassessing.',
        image: photo(8102129, 'Skincare products with serums, a gua sha tool and bar soap on dark fabric'),
      },
      {
        id: 's5',
        heading: 'On products that promise everything',
        body: 'A serum is a delivery format, not an efficacy claim. When a label lists nine actives without a concentration for any of them, the honest reading is that none of them is at a level that does anything. Concentration and pH are where the information lives.\n\nIf a brand will not tell you what is in a formula and at what percentage, that is a reasonable thing to be annoyed about.',
      },
    ],
  },
  {
    id: 'post-02',
    slug: 'how-to-layer-actives',
    title: 'How to layer actives without wrecking your barrier',
    excerpt:
      'Retinol, vitamin C, acids, niacinamide. What goes over what, which combinations cancel each other out, and how to introduce a new active without a flare.',
    category: 'ingredient',
    author: 'Dr. Iris Halloran',
    readingTimeMinutes: 9,
    publishedAt: '2026-07-28T09:00:00.000Z',
    image: photo(8101529, 'Minimalist cosmetic dropper bottle with shadow play'),
    tags: ['Actives', 'Retinoids', 'Exfoliation'],
    featured: true,
  productIds: ['prod-vitamin-c-serum', 'prod-niacinamide-serum', 'prod-retinal-serum', 'prod-peptide-serum'],
    position: 2,
    status: 'active',
    visible: true,
    seo: {
      title: 'How to layer skincare actives',
      description: 'A practical guide to combining retinol, vitamin C, acids and niacinamide.',
      canonicalPath: '/journal/how-to-layer-actives',
    },
    createdAt: '2026-07-28T09:00:00.000Z',
    updatedAt: '2026-07-28T09:00:00.000Z',
    body: [
      {
        id: 's1',
        body: 'The internet has produced a great deal of advice about which actives cancel each other out, and a good deal of it is overstated. Two of the combinations that genuinely matter account for most of the irritation people experience from layered actives.',
        image: photo(12146904, 'Close-up of elegant glass bottles with droppers'),
      },
      {
        id: 's2',
        heading: 'The two that genuinely conflict',
        body: 'Direct acids and retinoids accelerate cell turnover by different mechanisms, and using strong versions of both in one routine is the most reliable route to a damaged barrier we know of. Break them onto different nights and both become considerably easier to tolerate.\n\nLow-pH vitamin C and direct acids are the second pairing. Both are acidic, both are irritating on compromised skin, and layering them is how a person discovers they are sensitive to vitamin C when they are in fact sensitive to the acid beneath it.',
        list: [
          'Retinoids and direct acids — different nights, always.',
          'Vitamin C and direct acids — different routines, or different days.',
          'Niacinamide with essentially everything — one of the few genuinely universal actives.',
          'Bakuchiol with retinoids — possible, but introduce them separately so you know which is responsible.',
        ],
      },
      {
        id: 's3',
        heading: 'Order of application',
        body: 'Water-based and light textures first, heavier and oil-based textures last, with sunscreen as the final morning step. Skin does not care about marketing categories; it cares about consistency of texture and pH.',
        pullQuote: 'Skin does not care about marketing categories. It cares about pH and consistency.',
      },
      {
        id: 's4',
        heading: 'Introducing an active',
        body: 'Use it every other day for two weeks. If there is no reaction, move to every other night. After a month, try nightly. If at any point the skin becomes tight, flaky or reactive, stop for two weeks, repair the barrier, and start again more slowly.\n\nThe most common mistake is abandoning an effective product during the adjustment period, which is exactly the period during which it is most likely to be working.',
      },
    ],
  },
  {
    id: 'post-03',
    slug: 'barrier-repair-in-four-weeks',
    title: 'Repairing a compromised barrier in four weeks',
    excerpt:
      'Over-exfoliation is common, uncomfortable and reversible. Here is the protocol we would give a client, and the signs that mean you should stop.',
    category: 'skin-school',
    author: 'Aoife Brennan, Formulator',
    readingTimeMinutes: 8,
    publishedAt: '2026-06-19T09:00:00.000Z',
    image: photo(13794471, 'Open jar of barrier cream on marble'),
    tags: ['Barrier', 'Sensitivity', 'Protocol'],
    featured: true,
  productIds: ['prod-barrier-serum', 'prod-ceramide-cream', 'prod-softening-milk-cleanser'],
    position: 3,
    status: 'active',
    visible: true,
    seo: {
      title: 'How to repair your skin barrier',
      description: 'A four-week protocol for over-exfoliated, sensitised skin.',
      canonicalPath: '/journal/barrier-repair-in-four-weeks',
    },
    createdAt: '2026-06-19T09:00:00.000Z',
    updatedAt: '2026-06-19T09:00:00.000Z',
    body: [
      {
        id: 's1',
        body: 'A compromised barrier presents in a recognisable way: skin that stings when water hits it, feels tight immediately after cleansing, looks dull regardless of how much hydration you add, and appears shinier in some places and flakier in others within the same routine.\n\nThis is not a skin type. It is a temporary state, and it is one of the few conditions in skincare that reliably responds to discipline rather than purchase.',
      },
      {
        id: 's2',
        heading: 'Weeks one and two: remove',
        body: 'Stop every active. Not reduce — stop. No retinoids, no acids, no vitamin C, no exfoliation of any kind. What remains is a cleanser, a lipid-rich moisturiser, and SPF.',
        list: [
          'Gentle, pH-matched cleanser, once a day if you can manage it.',
          'A ceramide and cholesterol cream, twice a day.',
          'SPF every morning. Skipping this slows recovery more than any active you have removed.',
          'Nothing else. No serums, no masks, no new products to test.',
        ],
      },
      {
        id: 's3',
        heading: 'Weeks three and four: rebuild',
        body: 'If stinging has stopped and tightness is markedly reduced, reintroduce one thing. Niacinamide first, because it is the active least likely to cause a further setback. Twice a week for a week, then more often.\n\nHold retinoids back until week six at the earliest, and go back to the slow build-up schedule rather than starting where you left off.',
        image: photo(7691098, 'Elegant white skincare products arranged on a light background'),
      },
      {
        id: 's4',
        heading: 'How to know it has recovered',
        body: 'Cleanse and wait. The moment skin stops feeling tight within seconds of rinsing — not after moisturising, but before it — the barrier is functionally intact. That is the test, and it takes ten seconds.',
        pullQuote: 'The moment skin stops feeling tight seconds after rinsing, the barrier is intact.',
      },
    ],
  },
  {
    id: 'post-04',
    slug: 'retinoid-realism',
    title: 'Retinoid realism: what twelve weeks actually looks like',
    excerpt:
      'What a realistic retinoid timeline looks like week by week, why week two is where people quit, and what a normal adjustment is not.',
    category: 'ingredient',
    author: 'Dr. Iris Halloran',
    readingTimeMinutes: 6,
    publishedAt: '2026-05-30T09:00:00.000Z',
    image: photo(3785147, 'Luxury skincare products arranged on a warm soft surface'),
    tags: ['Retinoids', 'Timeline', 'Realism'],
    featured: false,
  productIds: ['prod-retinal-serum', 'prod-peptide-serum'],
    position: 4,
    status: 'active',
    visible: true,
    seo: {
      title: 'Retinoid results: a realistic timeline',
      description: 'What to expect from a retinoid at weeks two, eight and twelve.',
      canonicalPath: '/journal/retinoid-realism',
    },
    createdAt: '2026-05-30T09:00:00.000Z',
    updatedAt: '2026-05-30T09:00:00.000Z',
    body: [
      {
        id: 's1',
        body: 'Retinoids have a marketing problem. They are presented as products with a turning point, and almost nobody is told what the weeks before that turning point feel like. Most people quit in week two, which is the single most expensive timing error in skincare.',
      },
      {
        id: 's2',
        heading: 'Weeks one to two: adjustment',
        body: 'Mild dryness, increased flaking and a slight tightness after cleansing. This is retinisation, and it is expected. What is not expected is burning, cracking or genuine pain. If you have those, stop and see a clinician rather than pushing through it.',
      },
      {
        id: 's3',
        heading: 'Weeks four to six: quiet',
        body: 'Skin has adapted. Flaking subsides and texture begins to look smoother. This is the phase where most people stop, because nothing dramatic has happened yet. Persisting through this is the entire difficulty of the active.',
        pullQuote: 'Week two is where most people quit, and it is the most expensive timing error in skincare.',
      },
      {
        id: 's4',
        heading: 'Weeks eight to twelve: visible change',
        body: 'Fine lines soften, pores refine and tone evens. The change is real and measurable, but it is a considered difference rather than a dramatic one, and anyone promising the latter is overselling.',
      },
    ],
  },
  {
    id: 'post-05',
    slug: 'what-we-refuse-to-put-in',
    title: 'What we refuse to put in, and why',
    excerpt:
      'Fragrance, drying alcohols, essential oils, mica. An explanation of the exclusions — and the occasions when we are wrong to be dogmatic.',
    category: 'ritual',
    author: 'Aoife Brennan, Formulator',
    readingTimeMinutes: 7,
    publishedAt: '2026-04-15T09:00:00.000Z',
    image: photo(10694878, 'Skincare products arranged with natural elements on a book'),
    tags: ['Formulation', 'Standards', 'Ingredients'],
    featured: true,
  productIds: ['prod-hydrating-essence', 'prod-barrier-serum', 'prod-ceramide-cream'],
    position: 5,
    status: 'active',
    visible: true,
    seo: {
      title: 'What we leave out, and why',
      description: 'Our formulation exclusions, explained, including where we think the dogma is unhelpful.',
      canonicalPath: '/journal/what-we-refuse-to-put-in',
    },
    createdAt: '2026-04-15T09:00:00.000Z',
    updatedAt: '2026-04-15T09:00:00.000Z',
    body: [
      {
        id: 's1',
        body: 'A brand that makes absolute claims about ingredients is usually selling something other than formulation. We hold a fairly short exclusion list, we can defend every item on it, and we are aware that some of it is genuinely contested.',
      },
      {
        id: 's2',
        heading: 'Fragrance and essential oils',
        body: 'Fragrance is the most common cause of contact dermatitis in skincare, and it is present in the overwhelming majority of products on the market, usually declared simply as "parfum".\n\nEssential oils are a different case, and we are less dogmatic about them. They are not inert, and for reactive skin they are a real risk — but a rosehip oil with a properly handled botanical fraction is not a fragrance oil.',
        list: [
          'Fragrance, parfum, aroma — excluded, no exceptions.',
          'Drying alcohols — denatured ethanol above a low threshold, excluded.',
          'Essential oils — excluded from anything aimed at reactive skin, used sparingly elsewhere.',
          'Mica — excluded from anything tinted, because the particle load is a genuine respiratory irritant.',
        ],
      },
      {
        id: 's3',
        heading: 'Silicones',
        body: 'We use silicones, and we are frequently criticised for it. They are inert, non-comedogenic at the levels used, and among the best-evidenced ingredients for reducing water loss. The "silicone suffocates your skin" claim does not survive contact with the dermatology literature.',
        pullQuote: 'The claim that silicones suffocate the skin does not survive contact with the literature.',
      },
      {
        id: 's4',
        heading: 'Where we are probably wrong',
        body: 'There are two places we hold a position we cannot fully defend. We avoid parabens, though the evidence against them at cosmetic concentrations is very weak. And we use minimal preservatives in an industry that largely requires them, which is only defensible because our packaging is genuinely airless.\n\nAnyone who tells you a product is completely preservative-free is either mistaken or lying.',
        image: photo(7670680, 'Minimalist skincare product containers on a grey background'),
      },
    ],
  },
  {
    id: 'post-06',
    slug: 'the-evening-ritual',
    title: 'Why your evening routine matters more than your morning one',
    excerpt:
      'Skin repairs overnight. A short, deliberate evening routine does more for the skin than a rushed morning one, and it is considerably easier to sustain.',
    category: 'ritual',
    author: 'Dr. Iris Halloran',
    readingTimeMinutes: 5,
    publishedAt: '2026-03-22T09:00:00.000Z',
    image: photo(6560315, 'Woman applying skincare cream after a shower'),
    tags: ['Ritual', 'Evening', 'Repair'],
    featured: false,
  productIds: ['prod-vitamin-c-serum', 'prod-retinal-serum', 'prod-barrier-serum'],
    position: 6,
    status: 'active',
    visible: true,
    seo: {
      title: 'The evening skincare routine',
      description: 'How to build a short, effective evening routine around overnight skin repair.',
      canonicalPath: '/journal/the-evening-ritual',
    },
    createdAt: '2026-03-22T09:00:00.000Z',
    updatedAt: '2026-03-22T09:00:00.000Z',
    body: [
      {
        id: 's1',
        body: 'The morning routine is constrained: you are late, there is SPF to remember, and the day is already happening. The evening routine has none of those problems, and it coincides with the period in which skin does most of its repair work.\n\nThis asymmetry is why so many people have better skin in the morning than their routine logically accounts for.',
      },
      {
        id: 's2',
        heading: 'A deliberate evening',
        body: 'Cleanse properly rather than quickly, because this is the only cleanse that has to deal with a full day of sunscreen. Apply one active and let it absorb. Finish with something occlusive, because overnight transepidermal water loss is higher than it is during the day.',
        list: [
          'Cleanse — thoroughly, with warm water and a clean cloth.',
          'Treat — one active, on clean dry skin, sixty seconds to absorb.',
          'Seal — a lipid-rich cream, and an oil if your skin is dry.',
        ],
      },
      {
        id: 's3',
        heading: 'The pillowcase point',
        body: 'Not a well-controlled research area, which is worth stating plainly. Heavy overnight masks transfer to fabric, and this is not beneficial for either the skin or the bedding. Anything you use at night should absorb fully.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

/**
 * Testimonials.
 *
 * Intentionally empty. A testimonial is a real person saying something real, so
 * none exist until customers write them. The prototype's six invented
 * five-star quotes — with invented names, cities, and product associations —
 * have been removed rather than replaced.
 *
 * The type and the rendering path stay so real, approved testimonials can be
 * added later through the admin without touching presentation code.
 */
export const testimonials: Testimonial[] = [];

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

export const faqItems: FaqItem[] = [
  {
    id: 'faq-01',
    question: 'How do I know where to start?',
    answer:
      'Start with the four-step routine: cleanse, treat, moisturise, protect. If you are choosing a single first product, the Barrier Cloud Cream is the most broadly compatible thing we make. If your skin is currently reactive, start with the Softening Milk Cleanser alone for two weeks, then add the cream. If you want a shorter answer than that, the Barrier Discovery Set is a complete ten-day trial at true concentrations.',
    group: 'skin',
    position: 1,
    visible: true,
  },
  {
    id: 'faq-02',
    question: 'Why is sunscreen positioned as non-negotiable?',
    answer:
      'Because ultraviolet exposure is the largest single contributor to photoageing, it is cumulative, and no topical product reverses it. Antioxidants including vitamin C reduce the oxidative load that SPF cannot, which is why we pair them — but they are complementary, not a substitute. Sunscreen is the only step in any routine that prevents damage rather than addressing it.',
    group: 'skin',
    position: 2,
    visible: true,
  },
  {
    id: 'faq-03',
    question: 'How long before I see a difference?',
    answer:
      'Hydration and texture respond within days. Pigment and post-inflammatory marks take six to twelve weeks, because that is the turnover cycle. Retinoids take twelve weeks to show clearly, and the first fortnight is the period where most people abandon them. If a product claims a visible result in three days, it is almost certainly exfoliating rather than repairing.',
    group: 'products',
    position: 3,
    visible: true,
  },
  {
    id: 'faq-04',
    question: 'Can I use the retinal if I am pregnant or breastfeeding?',
    answer:
      'No. Retinoids including retinol, retinal and tretinoin are contraindicated in pregnancy and breastfeeding, and our formulations are labelled accordingly. Azelaic acid, niacinamide, vitamin C, ceramides, squalane and most sunscreens are considered appropriate. If you are pregnant and unsure about anything, your clinician is the right person to ask, not a skincare brand.',
    group: 'products',
    position: 4,
    visible: true,
  },
  {
    id: 'faq-05',
    question: 'Do your products contain fragrance?',
    answer:
      'No. No AUBE product contains fragrance, parfum, aroma or essential oils in the formulas marketed for reactive skin. Every ingredient list is published in full on the product page, and we will not add an ingredient we cannot justify. If a product page does not show a full list, contact us and we will send it.',
    group: 'products',
    position: 5,
    visible: true,
  },
  {
    id: 'faq-06',
    question: 'Can I use your products alongside a prescription retinoid?',
    answer:
      'Generally, yes — and often to good effect, because our barrier-supporting formulas buffer the irritation that makes prescription retinoids difficult to sustain. Introduce them one at a time with two weeks between so you can attribute any reaction correctly. If you are under dermatological care, follow your clinician\'s instructions over ours.',
    group: 'products',
    position: 6,
    visible: true,
  },
  {
    id: 'faq-07',
    question: 'What does shipping cost and how long does it take?',
    answer:
      'Standard shipping is $5 and takes three to five working days, and it is free on orders over $75. Express is $12 for one to two working days and Overnight is $24 for next working day when ordered before 4pm on a weekday. All shipping is carbon-neutral by default and plastic-free. We ship to the United States, United Kingdom, Canada, Ireland, Germany, France, the Netherlands and Australia.',
    group: 'shipping',
    position: 7,
    visible: true,
  },
  {
    id: 'faq-08',
    question: 'What is your returns policy?',
    answer:
      'Sixty days, opened or unopened, for any reason. We pay for the return label and there is no restocking fee and no requirement to explain. Refunds are issued to the original payment method within five working days of the return arriving. If a product caused a reaction, tell us — we would genuinely like to know so we can review the formulation.',
    group: 'orders',
    position: 8,
    visible: true,
  },
  {
    id: 'faq-09',
    question: 'How do I track an order?',
    answer:
      'A tracking link is emailed the moment your order is dispatched, and every order also appears under Orders in your account. If the tracking has not updated for two working days, contact us and we will chase the carrier rather than asking you to wait.',
    group: 'orders',
    position: 9,
    visible: true,
  },
  {
    id: 'faq-10',
    question: 'Are discovery sets the same strength as the full-size products?',
    answer:
      'Yes. The formulas are identical and the active concentrations are unchanged. The only differences are the container size and the airless packaging format, which we use because travel sizes sit in warm conditions far longer than a bottle on a shelf does. They are not diluted.',
    group: 'products',
    position: 10,
    visible: true,
  },
  {
    id: 'faq-11',
    question: 'Do you test on animals?',
    answer:
      'No. We do not test on animals, and we do not sell into markets that require it. If you want documentation for a specific formula, ask us and we will send the paperwork we actually hold — we would rather say "we cannot produce that" than cite a certificate we do not have.',
    group: 'products',
    position: 11,
    visible: true,
  },
  {
    id: 'faq-12',
    question: 'What is your subscription or refill situation?',
    answer:
      'We do not run a subscription programme, deliberately. Presenting skincare as something to be subscribed to encourages people to keep using a product after it has stopped working for them. The Resurfacing Pads refill is sold as a separate product rather than a locked-in subscription, and you can reorder whenever you like.',
    group: 'orders',
    position: 12,
    visible: true,
  },
];

/* ------------------------------------------------------------------ */
/* Long-form page content                                              */
/* ------------------------------------------------------------------ */

export const aboutPage: ContentPage = {
  slug: 'about',
  eyebrow: 'Our story',
  title: 'We started because the ingredient lists were unreadable and the claims were unreadable too',
  intro:
    'AUBE was founded by two people: a dermatology registrar who kept writing the same routine out for patients, and a formulator who kept explaining why the products on the shelf would not do it. Everything since has been an attempt to close that gap between what is known and what is sold.',
  heroImage: photo(7691112, 'Minimalist arrangement of white skincare products and towels'),
  seo: {
    title: 'About AUBE',
    description: 'Why AUBE publishes active concentrations, pH and full ingredient lists on every product page.',
  },
  sections: [
    {
      id: 'standards',
      heading: 'What we publish, and what we refuse',
      body: [
        'Every product page states the concentration of every active and the pH it is formulated to. It is information most brands omit because it invites comparison, and comparison is expensive.',
        'We do not use fragrance, essential oils in reactive-skin formulas, drying alcohols, or mica. Where we hold a position we cannot fully defend, we say so — including our use of silicones, which we consider one of the most over-criticised ingredients in the category.',
        'Our claims are deliberately small. When a study measured a modest improvement, we say modest. We have turned down a claim on a product because it was technically true and practically misleading.',
      ],
      list: [
        'Every active listed with its concentration and working pH.',
        'Complete ingredient lists, on the page, not behind a request.',
        'Claims traced to named studies, available on request.',
        'No subscription programme, by deliberate policy.',
      ],
    },
    {
      id: 'process',
      heading: 'How things are made',
      body: [
        'We formulate in small batches with two manufacturing partners, one in the United Kingdom and one in the United States. Small batches mean actives are filled close to the date of dispatch, which matters enormously for anything unstable: our vitamin C is filled into an airless opaque pump specifically so it reaches you within weeks of manufacture rather than months.',
        'We batch-test every production run for pH, stability and microbial load, and we keep the records. If a formula drifts outside its specification it does not ship, regardless of how much of it is already packed.',
      ],
    },
    {
      id: 'promise',
      heading: 'What we will keep doing',
      body: [
        'Formulating fewer products than we could, and making each of them defensible.',
        'Publishing the information that lets you disagree with us.',
        'Selling at a price that does not require a discount code to justify.',
        'Using the smallest number of ingredients required to make a formula work.',
      ],
    },
  ],
};

export const contactPage: ContentPage = {
  slug: 'contact',
  eyebrow: 'Contact',
  title: 'Talk to a formulator, not a script',
  intro:
    'Every message is answered by someone who works on the formulations. We cannot give medical or diagnostic advice, and if that is what you need we will say so and help you find the right clinician instead of guessing.',
  seo: {
    title: 'Contact AUBE',
    description: 'Contact the AUBE customer care and formulation team.',
  },
  sections: [
    {
      id: 'channels',
      heading: 'How to reach us',
      body: [
        'We answer every message within one working day, Monday to Friday. Skin questions are usually answered by a formulator directly rather than passed to a general team.',
      ],
      list: [
        'Email — care@aube.com, answered within one working day.',
        'Telephone — +1 (415) 555-0142, Monday to Friday, 9am–5pm PT.',
        'Social — @aube, monitored by the same team that answers email.',
      ],
    },
    {
      id: 'before-you-write',
      heading: 'It may already be answered',
      body: [
        'The most common questions we receive concern active compatibility, patch testing and adjusting to a retinoid. All three are covered in the FAQ and the journal, and the answers there are more detailed than anything we could write in an email.',
      ],
      list: [
        'Active compatibility — see "How to layer actives without wrecking your barrier".',
        'Retinoid adjustment — see "Retinoid realism: what twelve weeks actually looks like".',
        'Barrier damage — see "Repairing a compromised barrier in four weeks".',
      ],
    },
    {
      id: 'reactions',
      heading: 'If you have had a reaction',
      body: [
        'Stop using the product and email us with the product name, your skin type and when you started. We will refund it without asking for a photograph or an explanation, and we will log the report so the formulation team can review it.',
        'If the reaction is severe — swelling, hives, difficulty breathing — seek medical care immediately rather than emailing us.',
      ],
    },
  ],
};

export const policies: Record<
  'shipping' | 'returns' | 'privacy' | 'terms' | 'accessibility',
  ContentPage
> = {
  shipping: {
    slug: 'shipping',
    eyebrow: 'Policy',
    title: 'Shipping & delivery',
    intro:
      'We ship from two warehouses — in Delaware, USA and Kent, UK. Orders are picked within one working day of being placed.',
    seo: { title: 'Shipping & delivery', description: 'Delivery times, costs and destinations for AUBE orders.' },
    sections: [
      {
        id: 'rates',
        heading: 'Rates and timings',
        body: [
          'Standard delivery is $5, or free on orders over $75, and takes three to five working days. Express is $12 and takes one to two working days. Overnight is $24 and arrives the next working day when ordered before 4pm on a weekday.',
          'All shipping is carbon-neutral by default and plastic-free. There is no minimum spend, no signature requirement and no customs handling fee on orders within the European Union.',
        ],
      },
      {
        id: 'international',
        heading: 'International orders',
        body: [
          'We currently ship to the United States, United Kingdom, Canada, Ireland, Germany, France, the Netherlands and Australia. Duties and import taxes are calculated and collected at checkout for most destinations, so nothing further is owed on delivery.',
        ],
      },
      {
        id: 'tracking',
        heading: 'Tracking',
        body: [
          'A tracking link is emailed when your order leaves the warehouse, and again if the carrier registers a delay. Every order is also visible under Orders in your account. If tracking has not updated for two working days, contact us and we will chase the carrier rather than asking you to wait.',
        ],
      },
    ],
  },
  returns: {
    slug: 'returns',
    eyebrow: 'Policy',
    title: 'Returns & refunds',
    intro:
      'Sixty days, opened or unopened, for any reason. We pay for the return label and there is no restocking fee.',
    seo: { title: 'Returns & refunds', description: 'Our 60-day returns policy, including opened products.' },
    sections: [
      {
        id: 'how',
        heading: 'How to return something',
        body: [
          'Start a return from your account under Orders, or contact us from the email address on your order. We will email a prepaid label. Print it, attach it to the parcel and drop the parcel at any collection point.',
          'Refunds are issued to the original payment method within five working days of the return arriving with us. We do not require a reason, a photograph, or an explanation.',
        ],
        list: [
          '60 days from delivery, opened or unopened.',
          'Prepaid return label included, at our cost.',
          'No restocking fee and no inspection.',
          'Refunded to the original payment method within 5 working days.',
        ],
      },
      {
        id: 'why',
        heading: 'Why the policy is this generous',
        body: [
          'Because skincare cannot be tried on properly in a shop, and a return policy that penalises opening a product is a return policy that stops people from finding out whether a formula works for them. It also removes any incentive to sell someone a product twice their skin does not need.',
        ],
      },
    ],
  },
  privacy: {
    slug: 'privacy',
    eyebrow: 'Policy',
    title: 'Privacy',
    intro:
      'We collect the minimum required to fulfil an order and, if you opt in, to send email. We do not sell data and we do not share it with advertisers.',
    seo: { title: 'Privacy policy', description: 'How AUBE collects, uses and protects your data.' },
    sections: [
      {
        id: 'collect',
        heading: 'What we collect',
        body: [
          'Order information — name, email, delivery address, phone if provided, and order contents. This is required to fulfil the order and is retained for the period required by tax law.',
          'Account information — email, name and saved addresses, if you choose to create an account.',
          'Marketing preferences — only if you opt in, and you can withdraw consent at any time from any email or from your account settings.',
        ],
      },
      {
        id: 'tracking',
        heading: 'Analytics and cookies',
        body: [
          'We use a privacy-respecting, cookieless analytics service that records aggregate page views without building a profile of you. No advertising or cross-site tracking pixels are used on this site.',
        ],
      },
      {
        id: 'rights',
        heading: 'Your rights',
        body: [
          'You can request a copy of the data we hold, ask us to correct it, or ask us to delete it. Write to us and we will action it within thirty days. Deleting your account does not affect the retention of order records we are legally required to keep.',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    eyebrow: 'Policy',
    title: 'Terms of sale',
    intro:
      'These terms govern purchases made through this site. They are written to be read rather than to be unanswerable.',
    seo: { title: 'Terms of sale', description: 'The terms governing purchases from the AUBE storefront.' },
    sections: [
      {
        id: 'orders',
        heading: 'Orders',
        body: [
          'Your order is an offer to buy. Acceptance occurs when we dispatch, at which point a contract is formed. We may decline an order — for example where a product is out of stock, where pricing was listed in obvious error, or where we cannot ship to the destination.',
          'If we decline after charging your card, the full amount is refunded to the original payment method within two working days.',
        ],
      },
      {
        id: 'advice',
        heading: 'No medical advice',
        body: [
          'Nothing on this site is medical advice, a diagnosis, or a substitute for consultation with a qualified clinician. Information about pregnancy suitability is general and must be confirmed with your own clinician.',
        ],
      },
      {
        id: 'liability',
        heading: 'Liability',
        body: [
          'Our liability for any claim arising from a product is limited to the amount you paid for it. Nothing here limits liability that cannot lawfully be limited, including for death or personal injury caused by negligence or for counterfeit goods supplied by us.',
        ],
      },
    ],
  },
  accessibility: {
    slug: 'accessibility',
    eyebrow: 'Policy',
    title: 'Accessibility',
    intro:
      'This site aims to meet WCAG 2.2 Level AA. If anything on it prevents you from using it, tell us and we will fix it and tell you when it is fixed.',
    seo: { title: 'Accessibility statement', description: 'The accessibility standard AUBE aims to meet, and how to report a barrier.' },
    sections: [
      {
        id: 'standard',
        heading: 'Our standard',
        body: [
          'We target WCAG 2.2 Level AA. That means every interactive element is reachable and operable by keyboard, every form control has a programmatically associated label, focus is always visible, and colour is never the only means of conveying information.',
        ],
        list: [
          'Semantic landmarks on every page, and a skip link to main content.',
          'Visible focus indicators that meet contrast requirements.',
          'Alt text on all product and editorial imagery.',
          'Status changes announced to screen readers via live regions.',
          'Motion respects the prefers-reduced-motion preference.',
        ],
      },
      {
        id: 'report',
        heading: 'Reporting a barrier',
        body: [
          'Email care@aube.com with the page address and a description of what you were trying to do. We aim to acknowledge within two working days and to fix confirmed issues within one release cycle.',
        ],
      },
    ],
  },
};
