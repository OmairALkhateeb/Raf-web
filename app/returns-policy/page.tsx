import type { Metadata } from 'next';
import { getServerDictionary } from '@/lib/i18n/server';
import LocalizedLegalDocument from '@/components/legal/LocalizedLegalDocument';
import CmsDocumentView from '@/components/cms/CmsDocumentView';
import CmsHtmlBody from '@/components/cms/CmsHtmlBody';
import { fetchEditedLegalPage } from '@/lib/cms/legal';
import { localizeCmsPage } from '@/lib/cms/localize';

const titles = {
  ar: 'سياسة الاسترجاع والاستبدال واسترداد المبالغ',
  en: 'Returns, Exchanges and Refunds Policy',
};

export async function generateMetadata(): Promise<Metadata> {
  const [{ language, t }, cmsPage] = await Promise.all([
    getServerDictionary(),
    fetchEditedLegalPage('returns'),
  ]);
  if (cmsPage) return { title: localizeCmsPage(cmsPage, language).title };
  return { title: t.meta.returnsPolicy, description: titles[language] };
}

function ArabicReturnsPolicy() {
  return (
    <>
      <p className="mb-8 text-sm text-[#2D1F1F]/60">
        آخر تحديث: 28 سبتمبر 2026 | الإصدار 1.0
      </p>

      <div className="space-y-10">
        <section>
          <h2>1. مقدمة ونطاق السياسة</h2>

          <div className="space-y-4">
            <p>
              توضّح هذه السياسة الشروط والإجراءات المنظّمة لإلغاء الطلبات،
              واسترجاع المنتجات واستبدالها، واسترداد المبالغ المدفوعة عبر منصة
              RAF Marketplace، المملوكة والمُدارة من قبل مشاريع الخزيمي الحديثة
              للتجارة – شركة تضامنية (سجل تجاري رقم 1373591) («نحن»، «المنصة»).
            </p>

            <p>
              تسري هذه السياسة على جميع الطلبات المنفّذة عبر تطبيقات المنصة
              ومواقعها الإلكترونية، وعلى جميع التجار المسجّلين الذين يعرضون
              منتجاتهم من خلالها. وتُطبّق بما لا يتعارض مع قانون حماية المستهلك
              ولائحته التنفيذية وسائر التشريعات المعمول بها في سلطنة عُمان،
              وفي حال وجود أي تعارض تكون الأولوية لأحكام القانون.
            </p>
          </div>
        </section>

        <section>
          <h2>2. دور المنصة والتاجر</h2>

          <ul>
            <li>
              المنصة سوق إلكتروني متعدد التجار، ويُعدّ التاجر البائع المباشر
              للمنتج والمسؤول عن جودته ومطابقته للوصف المعروض.
            </li>

            <li>
              تتولّى المنصة استقبال طلبات الاسترجاع ومتابعتها، والتنسيق بين
              العميل والتاجر وشركة الشحن، وتنفيذ الاسترداد المالي عبر مزوّد
              خدمة الدفع المعتمد.
            </li>

            <li>
              يجوز للتاجر اعتماد شروط استرجاع خاصة بمنتجاته تُعرض بوضوح في
              صفحة المنتج، بشرط ألّا تقلّ عن الحدّ الأدنى من الحقوق الواردة
              في هذه السياسة أو في القانون.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. إلغاء الطلب قبل الشحن</h2>

          <ul>
            <li>
              يحقّ للعميل إلغاء الطلب مجانًا من داخل التطبيق طالما لم تتغيّر
              حالته إلى «تم الشحن».
            </li>

            <li>
              يُستردّ المبلغ المدفوع كاملًا إلى وسيلة الدفع الأصلية وفق المدد
              الواردة في البند 8.
            </li>

            <li>
              بعد شحن الطلب، لا يمكن إلغاؤه، ويمكن للعميل تقديم طلب استرجاع
              بعد الاستلام وفق هذه السياسة.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. حالات الاسترجاع والاستبدال</h2>

          <div className="space-y-8">
            <div className="space-y-4">
              <h3>أ. المنتج المعيب أو غير المطابق</h3>

              <p>
                يحقّ للعميل استرجاع المنتج أو استبداله خلال 14 يومًا من تاريخ
                الاستلام في الحالات التالية:
              </p>

              <ul>
                <li>وجود عيب مصنعي أو تلف في المنتج.</li>

                <li>
                  استلام منتج مختلف عن المطلوب (من حيث النوع أو المقاس أو
                  اللون أو الكمية).
                </li>

                <li>
                  عدم مطابقة المنتج للوصف أو الصور المعروضة في المنصة.
                </li>

                <li>وصول المنتج تالفًا نتيجة الشحن.</li>
              </ul>

              <p>
                يُوصى بإبلاغ المنصة عن التلف الظاهر أو النقص في الطلب خلال
                48 ساعة من الاستلام مع إرفاق صور توضيحية، لتسهيل التحقق
                وتسريع المعالجة. وفي هذه الحالات يتحمّل التاجر أو المنصة
                كامل تكاليف الشحن والإرجاع.
              </p>
            </div>

            <div className="space-y-4">
              <h3>ب. الاسترجاع لرغبة العميل (تغيير الرأي)</h3>

              <p>
                يحقّ للعميل طلب استرجاع المنتج دون إبداء أسباب خلال 7 أيام
                من تاريخ الاستلام، بالشروط التالية:
              </p>

              <ul>
                <li>
                  أن يكون المنتج بحالته الأصلية، غير مستخدم وغير مغسول،
                  ومع جميع ملحقاته وملصقاته وتغليفه الأصلي.
                </li>

                <li>
                  أن يكون مصحوبًا بما يثبت الشراء من المنصة (رقم الطلب).
                </li>

                <li>ألّا يكون من المنتجات المستثناة في البند 5.</li>
              </ul>

              <p>
                وفي هذه الحالة يتحمّل العميل تكلفة شحن الإرجاع، وتُخصم من
                المبلغ المسترد ما لم يُعلن خلاف ذلك.
              </p>
            </div>

            <div className="space-y-4">
              <h3>ج. الاستبدال</h3>

              <p>
                يمكن استبدال المنتج بمقاس أو لون آخر من المنتج نفسه وفق
                توفره لدى التاجر. وإذا تعذّر الاستبدال لعدم التوفر، يُعامل
                الطلب كطلب استرجاع ويُستردّ المبلغ.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2>5. المنتجات غير القابلة للاسترجاع</h2>

          <div className="space-y-4">
            <p>
              لا تُقبل إعادة المنتجات التالية لرغبة العميل، إلّا إذا كانت
              معيبة أو غير مطابقة للوصف:
            </p>

            <ul>
              <li>
                المنتجات الغذائية والقابلة للتلف والزهور الطبيعية.
              </li>

              <li>
                مستحضرات التجميل والعطور ومنتجات العناية الشخصية بعد فتحها
                أو إزالة ختمها.
              </li>

              <li>
                الملابس الداخلية وملابس السباحة والمنتجات المرتبطة بالنظافة
                الشخصية.
              </li>

              <li>
                المنتجات المصنوعة أو المعدّلة حسب طلب العميل (مثل الطباعة
                أو التطريز أو المقاسات الخاصة).
              </li>

              <li>
                بطاقات الهدايا والمنتجات والخدمات الرقمية بعد تفعيلها أو
                استخدامها.
              </li>

              <li>
                المنتجات التي يُنصّ صراحةً في صفحتها على أنها غير قابلة
                للاسترجاع، بما لا يتعارض مع القانون.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2>6. إجراءات تقديم طلب الاسترجاع</h2>

          <div className="space-y-4">
            <ol>
              <li>
                الدخول إلى «طلباتي» في التطبيق واختيار الطلب والمنتج المراد
                استرجاعه.
              </li>

              <li>
                تحديد سبب الاسترجاع وإرفاق صور واضحة عند الحاجة.
              </li>

              <li>
                مراجعة الطلب من قبل المنصة والتاجر والرد عليه خلال يومَي
                عمل.
              </li>

              <li>
                عند الموافقة، يتم التنسيق مع شركة الشحن لاستلام المنتج من
                عنوان العميل، أو إرشاد العميل إلى طريقة الإرجاع المتاحة.
              </li>

              <li>
                فحص المنتج بعد وصوله خلال 3 أيام عمل للتأكد من استيفائه
                للشروط.
              </li>

              <li>
                إخطار العميل بنتيجة الفحص عبر إشعار داخل التطبيق أو البريد
                الإلكتروني، ثم تنفيذ الاسترداد أو الاستبدال.
              </li>
            </ol>

            <p>
              يمكن متابعة حالة طلب الاسترجاع في أي وقت من صفحة الطلب داخل
              التطبيق.
            </p>
          </div>
        </section>

        <section>
          <h2>7. رفض طلب الاسترجاع</h2>

          <div className="space-y-4">
            <p>
              يجوز رفض طلب الاسترجاع في الحالات التالية، مع توضيح السبب
              للعميل:
            </p>

            <ul>
              <li>تقديم الطلب بعد انتهاء المدة المحددة.</li>

              <li>
                وجود آثار استخدام أو تلف ناتج عن سوء الاستخدام من قبل
                العميل.
              </li>

              <li>
                فقدان الملحقات أو التغليف الأصلي أو إزالة الملصقات.
              </li>

              <li>كون المنتج من الفئات المستثناة في البند 5.</li>
            </ul>

            <p>
              وفي حال الرفض بعد فحص المنتج، يُعاد المنتج إلى العميل، وقد
              يتحمّل العميل تكلفة إعادة شحنه.
            </p>
          </div>
        </section>

        <section>
          <h2>8. استرداد المبالغ</h2>

          <ul>
            <li>
              يُستردّ المبلغ إلى وسيلة الدفع الأصلية عبر مزوّد خدمة الدفع
              المعتمد ثواني (Thawani)، وبالعملة التي تمّ بها الدفع (الريال
              العُماني).
            </li>

            <li>
              تبدأ المنصة إجراء الاسترداد خلال 3 أيام عمل من اعتماد طلب
              الاسترجاع أو إلغاء الطلب.
            </li>

            <li>
              قد يستغرق ظهور المبلغ في حساب العميل من 5 إلى 14 يوم عمل
              بحسب إجراءات البنك المُصدر للبطاقة، ولا تتحكّم المنصة في هذه
              المدة.
            </li>

            <li>
              يشمل الاسترداد قيمة المنتج، وتُستردّ رسوم التوصيل الأصلية
              كاملة إذا كان سبب الاسترجاع عيبًا أو خطأً من التاجر أو المنصة.
            </li>

            <li>
              في حال استرجاع جزء من الطلب، يُستردّ المبلغ المقابل للمنتجات
              المُعادة فقط، مع مراعاة أي خصومات أو عروض طُبّقت على الطلب
              كاملًا.
            </li>

            <li>
              لا تحتفظ المنصة بأي بيانات حساسة لبطاقات الدفع، وتتم عملية
              الاسترداد بالكامل عبر مزوّد الدفع وفق ما هو موضّح في سياسة
              الخصوصية.
            </li>
          </ul>
        </section>

        <section>
          <h2>9. الطلبات غير المستلمة</h2>

          <ul>
            <li>
              إذا لم يصل الطلب خلال المدة المتوقعة، يُرجى التواصل مع المنصة
              لمتابعته مع شركة الشحن.
            </li>

            <li>
              إذا ثبت فقدان الشحنة، يُستردّ المبلغ كاملًا أو يُعاد إرسال
              الطلب حسب رغبة العميل وتوفر المنتج.
            </li>

            <li>
              إذا تعذّر التسليم بسبب خطأ في العنوان أو عدم استجابة العميل
              بعد محاولات التوصيل، قد تُخصم تكاليف الشحن من المبلغ المسترد.
            </li>
          </ul>
        </section>

        <section>
          <h2>10. النطاق الجغرافي</h2>

          <p>
            تُطبّق هذه السياسة حاليًا على الطلبات المُسلّمة داخل سلطنة عُمان،
            وسيتم تحديثها قبل التوسع إلى أي سوق جديدة.
          </p>
        </section>

        <section>
          <h2>11. حل النزاعات</h2>

          <p>
            نسعى إلى حل أي خلاف بشأن الاسترجاع أو الاسترداد بصورة ودية
            ومباشرة. وفي حال عدم الوصول إلى حل مُرضٍ، يحتفظ العميل بحقه في
            اللجوء إلى هيئة حماية المستهلك أو الجهات المختصة في سلطنة عُمان.
          </p>
        </section>

        <section>
          <h2>12. التعديلات على هذه السياسة</h2>

          <p>
            قد تُحدّث هذه السياسة من وقت لآخر لتعكس أي تغييرات تشغيلية أو
            قانونية. ويُشار إلى تاريخ آخر تحديث أعلى هذه الوثيقة، وسيتم
            إخطار المستخدمين بأي تعديل جوهري عبر البريد الإلكتروني المسجّل
            أو إشعار داخل التطبيق. وتُطبّق السياسة السارية وقت تقديم الطلب
            على ذلك الطلب.
          </p>
        </section>

        <section>
          <h2>13. التواصل معنا</h2>

          <div className="space-y-4">
            <p>
              لأي استفسار بخصوص هذه السياسة أو لمتابعة طلب استرجاع، يُرجى
              التواصل عبر:
            </p>

            <ul>
              <li>
                البريد الإلكتروني:{' '}
                <bdi dir="ltr">info@raffboutique.com</bdi>
              </li>

              <li>
                الهاتف: <bdi dir="ltr">+968 96919896</bdi>
              </li>

              <li>
                العنوان: الخوض، ولاية السيب، محافظة مسقط – سلطنة عُمان
              </li>

              <li>
                المقر الرئيسي المسجّل: لوى، محافظة شمال الباطنة، ص.ب 121،
                ر.ب 325
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

function EnglishReturnsPolicy() {
  return (
    <>
      <p className="mb-8 text-sm text-[#2D1F1F]/60">
        Last updated: 28 September 2026 | Version 1.0
      </p>

      <div className="space-y-10">
        <section>
          <h2>1. Introduction and Scope of the Policy</h2>

          <div className="space-y-4">
            <p>
              This policy sets out the terms and procedures governing order
              cancellations, product returns and exchanges, and refunds of
              payments made through RAF Marketplace, which is owned and operated
              by{' '}
              <bdi dir="rtl">
                مشاريع الخزيمي الحديثة للتجارة – شركة تضامنية
              </bdi>{' '}
              (a general partnership, Commercial Registration No. 1373591)
              (&quot;we&quot;, &quot;the Platform&quot;).
            </p>

            <p>
              This policy applies to all orders placed through the
              Platform&apos;s applications and websites, and to all registered
              merchants offering their products through it. It applies to the
              extent that it does not conflict with the Consumer Protection
              Law, its Executive Regulations or other legislation applicable
              in the Sultanate of Oman. In the event of a conflict, the
              provisions of the law prevail.
            </p>
          </div>
        </section>

        <section>
          <h2>2. Roles of the Platform and the Merchant</h2>

          <ul>
            <li>
              The Platform is a marketplace with multiple merchants. The
              merchant is the direct seller of the product and is responsible
              for its quality and conformity with the displayed description.
            </li>

            <li>
              The Platform receives and follows up on return requests,
              coordinates between the customer, the merchant and the shipping
              company, and processes refunds through the approved payment
              service provider.
            </li>

            <li>
              A merchant may adopt return terms specific to its products,
              provided that they are clearly displayed on the product page and
              do not provide less than the minimum rights set out in this
              policy or in the law.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Cancelling an Order Before Shipment</h2>

          <ul>
            <li>
              The customer may cancel an order free of charge within the
              application as long as its status has not changed to
              &quot;Shipped&quot;.
            </li>

            <li>
              The full amount paid will be refunded to the original payment
              method within the timeframes specified in Section 8.
            </li>

            <li>
              An order cannot be cancelled after shipment. The customer may
              submit a return request after receiving it, in accordance with
              this policy.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Returns and Exchanges</h2>

          <div className="space-y-8">
            <div className="space-y-4">
              <h3>A. Defective or Non-Conforming Products</h3>

              <p>
                The customer may return or exchange a product within 14 days
                of receipt in the following cases:
              </p>

              <ul>
                <li>
                  The product has a manufacturing defect or is damaged.
                </li>

                <li>
                  The product received differs from the order in type, size,
                  colour or quantity.
                </li>

                <li>
                  The product does not match the description or images
                  displayed on the Platform.
                </li>

                <li>
                  The product arrives damaged as a result of shipping.
                </li>
              </ul>

              <p>
                It is recommended that visible damage or missing items be
                reported to the Platform within 48 hours of receipt, with
                explanatory photographs, to facilitate verification and speed
                up processing. In these cases, the merchant or the Platform
                bears all shipping and return costs.
              </p>
            </div>

            <div className="space-y-4">
              <h3>B. Returns at the Customer&apos;s Request (Change of Mind)</h3>

              <p>
                The customer may request a return without giving a reason
                within 7 days of receipt, subject to the following conditions:
              </p>

              <ul>
                <li>
                  The product must be in its original condition, unused and
                  unwashed, with all accessories, labels and original
                  packaging.
                </li>

                <li>
                  It must be accompanied by proof of purchase from the
                  Platform (the order number).
                </li>

                <li>
                  It must not be one of the products excluded under Section 5.
                </li>
              </ul>

              <p>
                In this case, the customer bears the return shipping cost,
                which will be deducted from the refund unless otherwise
                announced.
              </p>
            </div>

            <div className="space-y-4">
              <h3>C. Exchanges</h3>

              <p>
                A product may be exchanged for a different size or colour of
                the same product, subject to the merchant&apos;s stock
                availability. If an exchange is not possible because the
                product is unavailable, the request will be treated as a
                return and the amount will be refunded.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2>5. Products Excluded from Change-of-Mind Returns</h2>

          <div className="space-y-4">
            <p>
              The following products cannot be returned at the customer&apos;s
              request unless they are defective or do not match their
              description:
            </p>

            <ul>
              <li>Food products, perishable goods and natural flowers.</li>

              <li>
                Cosmetics, perfumes and personal care products once opened
                or their seals removed.
              </li>

              <li>Underwear, swimwear and personal hygiene products.</li>

              <li>
                Products made or modified to the customer&apos;s
                specifications, such as printing, embroidery or custom sizes.
              </li>

              <li>
                Gift cards and digital products and services once activated
                or used.
              </li>

              <li>
                Products expressly identified on their pages as
                non-returnable, to the extent permitted by law.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2>6. How to Submit a Return Request</h2>

          <div className="space-y-4">
            <ol>
              <li>
                Open &quot;My Orders&quot; in the application and select the
                order and the product you wish to return.
              </li>

              <li>
                Select the reason for the return and attach clear photographs
                when needed.
              </li>

              <li>
                The Platform and the merchant review the request and respond
                within 2 business days.
              </li>

              <li>
                Once approved, arrangements are made with the shipping
                company to collect the product from the customer&apos;s
                address, or the customer is advised of the available return
                method.
              </li>

              <li>
                The product is inspected within 3 business days of arrival
                to confirm that it meets the conditions.
              </li>

              <li>
                The customer is notified of the inspection result through an
                in-app notification or email, after which the refund or
                exchange is processed.
              </li>
            </ol>

            <p>
              The status of a return request can be checked at any time on
              the order page within the application.
            </p>
          </div>
        </section>

        <section>
          <h2>7. Rejection of a Return Request</h2>

          <div className="space-y-4">
            <p>
              A return request may be rejected in the following cases, with
              the reason explained to the customer:
            </p>

            <ul>
              <li>
                The request is submitted after the specified period has
                expired.
              </li>

              <li>
                The product shows signs of use or damage caused by the
                customer&apos;s misuse.
              </li>

              <li>
                Accessories or original packaging are missing, or labels
                have been removed.
              </li>

              <li>
                The product falls within the excluded categories in
                Section 5.
              </li>
            </ul>

            <p>
              If the request is rejected after inspection, the product will
              be sent back to the customer, who may bear the cost of shipping
              it back.
            </p>
          </div>
        </section>

        <section>
          <h2>8. Refunds</h2>

          <ul>
            <li>
              Refunds are made to the original payment method through the
              approved payment service provider, Thawani, in the currency
              used for payment (Omani rials).
            </li>

            <li>
              The Platform initiates the refund process within 3 business
              days of approval of the return request or cancellation of the
              order.
            </li>

            <li>
              It may take 5 to 14 business days for the amount to appear in
              the customer&apos;s account, depending on the card-issuing
              bank&apos;s procedures. The Platform does not control this
              period.
            </li>

            <li>
              The refund includes the value of the product. The original
              delivery charges are refunded in full if the return is due
              to a defect or an error by the merchant or the Platform.
            </li>

            <li>
              For a partial return, only the amount corresponding to the
              returned products is refunded, taking into account any
              discounts or offers applied to the entire order.
            </li>

            <li>
              The Platform does not retain sensitive payment card data.
              The refund is processed entirely through the payment provider,
              as described in the Privacy Policy.
            </li>
          </ul>
        </section>

        <section>
          <h2>9. Orders Not Received</h2>

          <ul>
            <li>
              If an order does not arrive within the expected period, please
              contact the Platform so that it can follow up with the
              shipping company.
            </li>

            <li>
              If the shipment is confirmed lost, the full amount will be
              refunded or the order will be sent again, depending on the
              customer&apos;s preference and product availability.
            </li>

            <li>
              If delivery is unsuccessful because of an incorrect address
              or the customer&apos;s failure to respond after delivery
              attempts, shipping costs may be deducted from the refund.
            </li>
          </ul>
        </section>

        <section>
          <h2>10. Geographical Scope</h2>

          <p>
            This policy currently applies to orders delivered within the
            Sultanate of Oman. It will be updated before expansion into any
            new market.
          </p>
        </section>

        <section>
          <h2>11. Dispute Resolution</h2>

          <p>
            We aim to resolve any disagreement regarding returns or refunds
            amicably and directly. If a satisfactory resolution cannot be
            reached, the customer retains the right to refer the matter to
            the Consumer Protection Authority or the competent authorities
            in the Sultanate of Oman.
          </p>
        </section>

        <section>
          <h2>12. Changes to This Policy</h2>

          <p>
            This policy may be updated from time to time to reflect
            operational or legal changes. The date of the latest update
            is shown at the top of this document. Users will be notified
            of any material change through their registered email address
            or an in-app notification. The policy in force when the order
            is placed applies to that order.
          </p>
        </section>

        <section>
          <h2>13. Contact Us</h2>

          <div className="space-y-4">
            <p>
              For questions about this policy or to follow up on a return
              request, please contact us through:
            </p>

            <ul>
              <li>
                Email: <bdi dir="ltr">info@raffboutique.com</bdi>
              </li>

              <li>
                Phone: <bdi dir="ltr">+968 96919896</bdi>
              </li>

              <li>
                Address: Al Khoud, Wilayat of Seeb, Muscat Governorate –
                Sultanate of Oman
              </li>

              <li>
                Registered head office: Liwa, North Al Batinah Governorate,
                P.O. Box 121, Postal Code 325
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

export default async function ReturnsPolicyPage() {
  // The admin's version (CMS `returns`) once it has been edited there; until
  // then the built-in text below.
  const [cmsPage, { language }] = await Promise.all([
    fetchEditedLegalPage('returns'),
    getServerDictionary(),
  ]);
  if (cmsPage) {
    const page = localizeCmsPage(cmsPage, language);
    return (
      <CmsDocumentView
        status="ok"
        chrome="returnsPolicy"
        title={page.title}
        updatedAt={cmsPage.updatedAt}
      >
        <CmsHtmlBody html={page.html} />
      </CmsDocumentView>
    );
  }

  return (
    <LocalizedLegalDocument
      chrome="returnsPolicy"
      titles={titles}
      arabicContent={<ArabicReturnsPolicy />}
      englishContent={<EnglishReturnsPolicy />}
    />
  );
}