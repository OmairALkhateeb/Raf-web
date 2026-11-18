import type { Metadata } from 'next';
import { getServerDictionary } from '@/lib/i18n/server';
import LocalizedLegalDocument from '@/components/legal/LocalizedLegalDocument';
import CmsDocumentView from '@/components/cms/CmsDocumentView';
import CmsHtmlBody from '@/components/cms/CmsHtmlBody';
import { fetchEditedLegalPage } from '@/lib/cms/legal';
import { localizeCmsPage } from '@/lib/cms/localize';

const titles = {
  ar: 'شروط وأحكام استخدام RAF Marketplace للعملاء',
  en: 'RAF Marketplace Customer Terms and Conditions',
};

export async function generateMetadata(): Promise<Metadata> {
  const [{ language, t }, cmsPage] = await Promise.all([
    getServerDictionary(),
    fetchEditedLegalPage('terms'),
  ]);
  if (cmsPage) return { title: localizeCmsPage(cmsPage, language).title };
  return { title: t.meta.terms, description: titles[language] };
}

const sectionsAr = [
  {
    title: 'المادة (1): طبيعة المنصة.',
    paragraphs: [
      'RAF Marketplace هي منصة سوق إلكترونية تتيح للعملاء الوصول إلى منتجات يعرضها تجار مستقلون، وتوفر وسائل تقنية لتسهيل عرض المنتجات والطلبات والدفع والتواصل والخدمات المرتبطة بالمعاملة.',
      'ما لم يُذكر صراحة خلاف ذلك، فإن المنتج المعروض في المنصة يقدمه ويبيعه التاجر المبين في صفحة المنتج أو الطلب.',
      'يكون التاجر هو الطرف المسؤول عن المنتج ومصدره ووصفه ومواصفاته وجودته وضمانه وخدمات ما بعد البيع، وفقًا للقانون وشروط البيع المعلنة.',
    ],
  },
  {
    title: 'المادة (2): العلاقة بين العميل والتاجر.',
    paragraphs: [
      'عند شراء منتج من أحد التجار، تنشأ المعاملة المتعلقة بالمنتج بين العميل والتاجر، وتكون شروط المنتج ومواصفاته وسعره وضمانه وأي التزامات خاصة به وفق ما يظهر في صفحة المنتج والطلب والفاتورة والشروط المعمول بها.',
      'لا تعتبر المنصة، لمجرد استضافتها لعرض المنتج أو تسهيل الطلب أو الدفع، مصنعًا أو منتجًا أو مالكًا للمنتج أو ضامنًا لجودته أو أصالته، ما لم تنص المنصة صراحة على خلاف ذلك.',
      'لا يجوز تفسير هذه الأحكام على أنها إسقاط لأي حق أو ضمان مقرر للعميل بموجب القوانين النافذة في سلطنة عُمان.',
    ],
  },
  {
    title: 'المادة (3): جودة المنتجات ومطابقتها.',
    paragraphs: [
      'يتحمل التاجر المسؤولية عن مطابقة المنتج للوصف والصور والمواصفات المعلنة؛ وأصالة المنتج ومشروعية مصدره؛ وخلو المنتج من العيوب وفقًا للقانون؛ وسلامة المنتج واستيفائه الاشتراطات النظامية؛ والضمان المعلن أو المقرر قانونًا؛ والاستبدال أو الإصلاح أو الاسترجاع متى كان واجبًا قانونًا.',
      'ولا تقدم المنصة، كقاعدة عامة، ضمانًا مستقلًا لجودة المنتج أو ملاءمته لغرض معين، ما لم تنص صراحة على تقديم ضمان أو حماية إضافية.',
    ],
  },
  {
    title: 'المادة (4): المنتجات التالفة أو المعيبة.',
    paragraphs: [
      'إذا وصل المنتج تالفًا أو معيبًا أو غير مطابق للطلب، فعلى العميل إخطار التاجر والمنصة وفق آلية الشكاوى المعتمدة وإرفاق ما يلزم من صور أو مستندات.',
      'ويظل التاجر مسؤولًا عن معالجة العيب أو التلف أو عدم المطابقة وفق القانون وشروط البيع والضمان المطبق.',
    ],
  },
  {
    title: 'المادة (5): دور المنصة في النزاعات.',
    paragraphs: [
      'يجوز للمنصة، وفقًا لآلياتها الداخلية، استقبال الشكاوى والتواصل مع الطرفين وطلب المستندات ومحاولة تسوية النزاع.',
      'ولا يعني تدخل المنصة في النزاع أنها أقرت بأنها بائع المنتج أو ضامن لجودته.',
      'ويجوز للمنصة اتخاذ إجراءات مؤقتة لحماية المستخدمين، بما في ذلك تعليق المنتج أو حساب التاجر، متى رأت أن ذلك لازم وفق سياساتها والقانون.',
    ],
  },
  {
    title: 'المادة (6): الدفع.',
    paragraphs: [
      'قد تتم المدفوعات من خلال مزود دفع معتمد تتكامل معه المنصة.',
      'ولا يعني مرور المبلغ عبر المنصة أو مزود الدفع أن المنصة أصبحت مالكة للمنتج أو طرفًا بائعًا فيه، ما لم ينص على خلاف ذلك صراحة.',
    ],
  },
  {
    title: 'المادة (7): الشحن والتوصيل.',
    paragraphs: [
      'تُنفذ عمليات الشحن والتوصيل وفق الخيارات المتاحة في الطلب.',
      'ولا تتحمل المنصة مسؤولية التأخير أو التلف الذي يقع بسبب الناقل أو ظروف خارجة عن سيطرتها، وذلك في حدود ما يسمح به القانون، مع عدم الإخلال بأي حقوق إلزامية مقررة للعميل.',
    ],
  },
  {
    title: 'المادة (8): مسؤولية المنصة.',
    paragraphs: [
      'مع مراعاة المسؤوليات التي لا يجوز استبعادها أو الحد منها قانونًا، لا تكون المنصة مسؤولة عن جودة أو أصالة أو مصدر المنتجات التي يعرضها التجار؛ العيوب الخفية أو الظاهرة في المنتجات؛ عدم مطابقة المنتج للمواصفات التي أعلنها التاجر؛ الأضرار الناشئة عن استعمال المنتج على نحو مخالف لتعليمات التاجر أو الشركة المصنعة؛ الأفعال أو الأقوال أو البيانات غير الصحيحة الصادرة من التاجر؛ أو أي إخلال بالتزام يقع قانونًا أو تعاقدًا على التاجر بصفته بائع المنتج.',
      'ولا يسري أي استبعاد أو تحديد للمسؤولية إذا كان من شأنه مخالفة حكم قانوني آمر أو الانتقاص من حق مقرر للمستهلك بموجب القانون.',
    ],
  },
  {
    title: 'المادة (9): بيانات المنتجات.',
    paragraphs: [
      'تبذل المنصة جهدًا معقولًا لتوفير بيئة إلكترونية منظمة لعرض المنتجات، إلا أن البيانات والمواصفات والصور والضمانات المتعلقة بالمنتج مصدرها التاجر، ويتحمل التاجر مسؤولية صحتها.',
    ],
  },
  {
    title: 'المادة (10): المنتجات المخالفة.',
    paragraphs: [
      'إذا تبين للمنصة أن منتجًا قد يكون مغشوشًا أو مقلدًا أو غير مشروع أو يشكل خطرًا على المستخدمين، فيجوز لها إزالة المنتج أو تعليقه أو إيقاف حساب التاجر واتخاذ الإجراءات المناسبة وفق القانون.',
    ],
  },
  {
    title: 'المادة (11): الفاتورة والضمان.',
    paragraphs: [
      'تكون الفاتورة والضمان والمستندات الخاصة بالمنتج وفق ما يقدمه التاجر وما يوجبه القانون.',
      'ويجب على العميل الاحتفاظ بالفاتورة والمستندات المتعلقة بالشراء عند الحاجة إلى المطالبة بحقوقه.',
    ],
  },
  {
    title: 'المادة (12): الحساب والاستخدام.',
    paragraphs: [
      'يلتزم العميل بتقديم بيانات صحيحة عند إنشاء الحساب وإتمام الطلب، ويتحمل مسؤولية المحافظة على بيانات الدخول وعدم إساءة استخدام المنصة.',
    ],
  },
  {
    title: 'المادة (13): السجلات الإلكترونية.',
    paragraphs: [
      'يوافق العميل على استخدام السجلات الإلكترونية للطلبات والمدفوعات والمراسلات والموافقات المسجلة في أنظمة المنصة كوسيلة لإثبات التعامل، وفقًا للقانون.',
    ],
  },
  {
    title: 'المادة (14): تعديل الشروط.',
    paragraphs: [
      'يجوز للمنصة تحديث هذه الشروط من وقت لآخر بما يتفق مع تطور خدماتها والمتطلبات القانونية.',
      'وسيتم بيان تاريخ آخر تحديث، وقد تطلب المنصة من المستخدم قبول النسخة الجديدة عندما يكون ذلك مناسبًا.',
    ],
  },
  {
    title: 'المادة (15): القانون والاختصاص.',
    paragraphs: [
      'تخضع هذه الشروط للقوانين النافذة في سلطنة عُمان، وتختص المحاكم العمانية المختصة بأي نزاع يتعلق باستخدام المنصة أو هذه الشروط، وذلك دون إخلال بحقوق المستهلك والاختصاصات المقررة للجهات المختصة بموجب القانون.',
    ],
  },
  {
    title: 'المادة (16): القبول.',
    paragraphs: [
      'يعد قيام العميل بإنشاء الحساب أو إتمام الطلب أو الضغط على خانة "أوافق على الشروط والأحكام" قبولًا إلكترونيًا بهذه الشروط، وفقًا للنسخة السارية وقت القبول.',
    ],
  },
];

const sectionsEn = [
  {
    title: 'Article (1): Nature of the Platform.',
    paragraphs: [
      'RAF Marketplace is an online marketplace that enables customers to access products offered by independent merchants and provides technical tools to facilitate product listings, orders, payments, communication and services associated with the transaction.',
      'Unless expressly stated otherwise, the product listed on the Platform is supplied and sold by the merchant identified on the product page or in the order.',
      'The merchant is responsible for the product, its source, description, specifications, quality, warranty and after-sales services, in accordance with the law and the published terms of sale.',
    ],
  },
  {
    title: 'Article (2): Relationship Between the Customer and the Merchant.',
    paragraphs: [
      "When a product is purchased from a merchant, the transaction relating to that product is between the customer and the merchant. The product's terms, specifications, price, warranty and any specific obligations are governed by the information shown on the product page, in the order and invoice, and by the applicable terms.",
      'Merely hosting a product listing or facilitating an order or payment does not make the Platform the manufacturer, producer or owner of the product, or a guarantor of its quality or authenticity, unless the Platform expressly states otherwise.',
      'These provisions must not be interpreted as waiving any right or guarantee granted to the customer under the laws in force in the Sultanate of Oman.',
    ],
  },
  {
    title: 'Article (3): Product Quality and Conformity.',
    paragraphs: [
      "The merchant is responsible for the product's conformity with its advertised description, images and specifications; the product's authenticity and the lawful nature of its source; its freedom from defects in accordance with the law; its safety and compliance with regulatory requirements; any advertised or legally required warranty; and replacement, repair or return whenever required by law.",
      'As a general rule, the Platform does not provide an independent guarantee of product quality or fitness for a particular purpose, unless it expressly states that it provides an additional guarantee or protection.',
    ],
  },
  {
    title: 'Article (4): Damaged or Defective Products.',
    paragraphs: [
      'If a product arrives damaged, defective or different from the order, the customer must notify the merchant and the Platform through the approved complaints procedure and provide any necessary photographs or documents.',
      'The merchant remains responsible for addressing the defect, damage or non-conformity in accordance with the law, the terms of sale and the applicable warranty.',
    ],
  },
  {
    title: "Article (5): The Platform's Role in Disputes.",
    paragraphs: [
      'In accordance with its internal procedures, the Platform may receive complaints, communicate with both parties, request documents and attempt to resolve the dispute.',
      "The Platform's involvement in a dispute does not mean that it acknowledges being the seller of the product or a guarantor of its quality.",
      "The Platform may take temporary measures to protect users, including suspending a product listing or a merchant's account, whenever it considers this necessary in accordance with its policies and the law.",
    ],
  },
  {
    title: 'Article (6): Payment.',
    paragraphs: [
      'Payments may be processed through an approved payment provider integrated with the Platform.',
      'The transfer of funds through the Platform or the payment provider does not make the Platform the owner or seller of the product, unless expressly stated otherwise.',
    ],
  },
  {
    title: 'Article (7): Shipping and Delivery.',
    paragraphs: [
      'Shipping and delivery are carried out in accordance with the options available in the order.',
      'The Platform is not responsible for delays or damage caused by the carrier or circumstances beyond its control, to the extent permitted by law and without prejudice to any mandatory rights granted to the customer.',
    ],
  },
  {
    title: 'Article (8): Platform Liability.',
    paragraphs: [
      "Subject to liabilities that cannot legally be excluded or limited, the Platform is not responsible for the quality, authenticity or source of products offered by merchants; hidden or apparent product defects; a product's failure to meet specifications advertised by the merchant; damage arising from use of a product contrary to the merchant's or manufacturer's instructions; acts, statements or inaccurate information issued by the merchant; or any breach of an obligation that rests, by law or contract, with the merchant as the seller of the product.",
      'No exclusion or limitation of liability applies if it would contravene a mandatory legal provision or diminish a consumer right granted by law.',
    ],
  },
  {
    title: 'Article (9): Product Information.',
    paragraphs: [
      'The Platform makes reasonable efforts to provide an organised online environment for product listings. However, product information, specifications, images and warranties originate from the merchant, who is responsible for their accuracy.',
    ],
  },
  {
    title: 'Article (10): Non-Compliant Products.',
    paragraphs: [
      "If the Platform determines that a product may be fraudulent, counterfeit, unlawful or pose a risk to users, it may remove or suspend the product listing, suspend the merchant's account and take appropriate measures in accordance with the law.",
    ],
  },
  {
    title: 'Article (11): Invoices and Warranties.',
    paragraphs: [
      'Invoices, warranties and product documents are subject to what the merchant provides and what the law requires.',
      'The customer must retain the invoice and purchase-related documents when needed to assert their rights.',
    ],
  },
  {
    title: 'Article (12): Accounts and Use.',
    paragraphs: [
      'The customer must provide accurate information when creating an account and placing an order, and is responsible for safeguarding their login details and refraining from misuse of the Platform.',
    ],
  },
  {
    title: 'Article (13): Electronic Records.',
    paragraphs: [
      "The customer agrees to the use of electronic records of orders, payments, correspondence and consents recorded in the Platform's systems as evidence of transactions, in accordance with the law.",
    ],
  },
  {
    title: 'Article (14): Changes to the Terms.',
    paragraphs: [
      'The Platform may update these terms from time to time to reflect the development of its services and legal requirements.',
      'The date of the latest update will be indicated, and the Platform may require the user to accept the new version when appropriate.',
    ],
  },
  {
    title: 'Article (15): Governing Law and Jurisdiction.',
    paragraphs: [
      'These terms are governed by the laws in force in the Sultanate of Oman. The competent Omani courts have jurisdiction over disputes relating to use of the Platform or these terms, without prejudice to consumer rights or the powers granted to the competent authorities by law.',
    ],
  },
  {
    title: 'Article (16): Acceptance.',
    paragraphs: [
      'Creating an account, placing an order or selecting the "I agree to the Terms and Conditions" checkbox constitutes the customer’s electronic acceptance of these terms, in accordance with the version in force at the time of acceptance.',
    ],
  },
];

function TermsContent({
  sections,
  introduction,
}: {
  sections: typeof sectionsAr;
  introduction: string;
}) {
  return (
    <>
      <p className="mb-8">{introduction}</p>

      <div className="space-y-8">
        {sections.map((section, index) => {
          const headingId = `customer-terms-${index + 1}`;

          return (
            <section key={headingId} aria-labelledby={headingId}>
              <h2 id={headingId}>{section.title}</h2>

              <div className="space-y-4">
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={`${headingId}-${paragraphIndex}`}>{paragraph}</p>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export default async function TermsPage() {
  // The admin's version (CMS `terms`) once it has been edited there; until
  // then the built-in text below.
  const [cmsPage, { language }] = await Promise.all([
    fetchEditedLegalPage('terms'),
    getServerDictionary(),
  ]);
  if (cmsPage) {
    const page = localizeCmsPage(cmsPage, language);
    return (
      <CmsDocumentView
        status="ok"
        chrome="terms"
        title={page.title}
        updatedAt={cmsPage.updatedAt}
      >
        <CmsHtmlBody html={page.html} />
      </CmsDocumentView>
    );
  }

  return (
    <LocalizedLegalDocument
      chrome="terms"
      titles={titles}
      arabicContent={
        <TermsContent
          sections={sectionsAr}
          introduction="باستخدام منصة RAF Marketplace أو إنشاء حساب أو إتمام أي طلب من خلالها، يقر المستخدم بأنه قرأ هذه الشروط ووافق عليها."
        />
      }
      englishContent={
        <TermsContent
          sections={sectionsEn}
          introduction="By using RAF Marketplace, creating an account or placing any order through it, the user acknowledges that they have read and accepted these terms."
        />
      }
    />
  );
}