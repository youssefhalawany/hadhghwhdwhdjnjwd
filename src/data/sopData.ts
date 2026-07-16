export type SOPCategory = 'Bakery' | 'Pizza' | 'General';

export interface SOPBlock {
  type: 'text' | 'warning' | 'list' | 'recipe-table' | 'expiry-table' | 'highlight';
  titleEn?: string;
  titleAr?: string;
  itemsEn?: string[];
  itemsAr?: string[];
  textEn?: string;
  textAr?: string;
  tableData?: any; // specifically for the pizza recipes
}

export interface SOPItem {
  id: string;
  categoryEn: SOPCategory;
  categoryAr: string;
  titleEn: string;
  titleAr: string;
  tags: string[];
  blocks: SOPBlock[];
}

export const SOP_DATA: SOPItem[] = [
  {
    id: "bakery_proofing_baking",
    categoryEn: "Bakery",
    categoryAr: "البيكري",
    titleEn: "Bakery Proofing & Baking (Croissant & Pate)",
    titleAr: "طريقة تخمير وخبيز البيكري (كرواسون وباتيه)",
    tags: ["bakery", "croissant", "pate", "proof", "bake", "oven", "كرواسون", "باتيه", "مخبوزات", "فرن"],
    blocks: [
      {
        type: "list",
        itemsEn: [
          "Remove Croissant or Pate from the freezer and place them on the designated tray (max 8 pieces per tray) ensuring proper spacing. Leave them for 1.5 to 2 hours at room temperature (37°C).",
          "15 minutes before the proofing time ends, turn on the proofer until water condensation appears on the outer glass, indicating sufficient steam. Ensure the water bowl inside the proofer is filled.",
          "Place the Croissant or Pate into the proofer for 60 to 75 minutes. Monitor continuously and set the proofer temperature to 32°C.",
          "15 minutes before the end of the proofing process, turn on the oven to preheat it to 170°C.",
          "Remove the trays from the proofer gently without shaking them so the dough doesn't collapse. Glaze them with the egg wash mixture using a brush.",
          "Place the trays in the oven to bake for 18 to 20 minutes at 170°C, monitoring continuously.",
          "After baking, remove the trays using heat-resistant gloves and aerate them externally. Ensure Croissant length is 19-20cm with a center height of 4cm, and Pate length is 10-11cm with a width of 5-6cm and center height of 4cm.",
          "Place the baked goods in the display cabinet for sale."
        ],
        itemsAr: [
          "يتم إخراج الكرواسون أو الباتيه من الفريزر ورصهم بالصاج المخصص لذلك على ألا يزيد العدد عن 8 قطع في الصاج الواحد مع مراعاة وجود تباعد بين كل قطعة وأخرى، وتترك هذه القطع مدة لا تقل عن ساعة ونصف وقد تزيد الي ساعتين في درجة حرارة الغرفة أو المحل ( 37 درجة مئوية )",
          "قبل نهاية هذه المدة بربع ساعة يتم تشغيل المخمرة حتى يتم ظهور تكثيف المياه على الزجاج الخارجي للمخمرة مما يدل على أن هناك بخار كافي للتخمير مع التأكيد على ملء وعاء المياه داخل المخمرة.",
          "يتم إدخال الكرواسون أو الباتيه إلى المخمرة لمدة من ساعة إلى ساعة وربع، مع المتابعة المستمرة لذلك مع ضبط حرارة المخمرة عند 32 درجة مئوية.",
          "قبل نهاية عملية التخمير بمدة 15 دقيقة يتم تشغيل الفرن حتى الوصول إلى درجة حرارة إلى 170 درجة مئوية",
          "يتم إخراج محتويات الكرواسون أو الباتيه من المخمرة مع مراعاة عدم هز الصاجات بعد التخمير حتى لا يهبط العجين، ويتم تلميعهم بخليط البيض بواسطة الفرشاة.",
          "يتم إدخال الصاج في الفرن للتسوية لمدة من 18 إلى 20 دقيقة في درجة حرارة 170 درجة مع المتابعة المستمرة",
          "بعد إكتمال الخبيز يتم إخراج الصاجات من الفرن بواسطة الجوانتي الحراري، وتهويتها خارجياً. مع مراعاة ألا يقل طول الكرواسون عن 19-20 سم والإرتفاع في المنتصف عن 4 سم، و ألا يقل طول الباتيه عن 10-11 سم والعرض عن 5-6 سم والإرتفاع من المنتصف عن 4 سم.",
          "يتم وضع المخبوزات (الكرواسون أو الباتيه) في كابينة المخبوزات للعرض."
        ]
      },
      {
        type: "highlight",
        titleEn: "Egg Wash Preparation",
        titleAr: "طريقة تجهيز خليط البيض",
        itemsEn: [
          "Consists of 2 eggs + 10g cold milk + 10g vanilla + 10g heavy cream.",
          "Stir thoroughly until completely homogenous."
        ],
        itemsAr: [
          "يتكون من عدد (2) بيضة + 10 جرام لبن بارد + 10 جرام فانيليا + 10 جرام كريمة لباني",
          "يتم التقليب جيداً حتى تمام التجانس."
        ]
      }
    ]
  },
  {
    id: "bakery_receiving_warnings",
    categoryEn: "Bakery",
    categoryAr: "البيكري",
    titleEn: "Receiving & Warnings (Croissant - Pate - Cinnamon)",
    titleAr: "تعليمات تشغيل وإستلام البيكري والمحاذير",
    tags: ["warnings", "storage", "receiving", "bakery", "محاذير", "استلام", "تخزين", "بيكري"],
    blocks: [
      {
        type: "warning",
        titleEn: "Urgent Warnings",
        titleAr: "المحاذير",
        itemsEn: [
          "Strictly prohibited to store bakery items in the refrigerator.",
          "Strictly prohibited to store bakery items in the freezer.",
          "Strictly prohibited to heat bakery items in the microwave.",
          "Strictly prohibited to use the bakery cabinet merely for display; it is for active sales. Ensure it is tightly closed after any sale.",
          "Strictly prohibited to turn on lights or heating inside the bakery cabinet as it damages the bakery items."
        ],
        itemsAr: [
          "ممنوع منعاً باتاً تخزين البيكري في الثلاجة.",
          "ممنوع منعاً باتاً تخزين البيكري في الفريزر.",
          "ممنوع منعاً باتاً تسخين البيكري في الميكروويف.",
          "ممنوع منعاً باتاً إستخدام كابينة البيكري ككابينة عرض حيث أنها مخصصة للبيع، ويتم التأكد من غلقها بإحكام عند إتمام أية عمليات للبيع.",
          "ممنوع منعاً باتاً تشغيل إضاءة أو تسخين في كابينة البيكري حيث أنها تؤدي إلى إتلاف البيكري."
        ]
      },
      {
        type: "list",
        titleEn: "Receiving and Storage Method",
        titleAr: "طريقة الإستلام والتخزين",
        itemsEn: [
          "Bakery boxes are received daily and displayed in the bakery cabinet.",
          "Remaining quantities are stored in the back counter after wrapping the box securely with stretch film.",
          "Organize the bakery cabinet applying the FIFO (First In, First Out) rule.",
          "Shelf life is 48 hours at room temperature, and up to 72 hours if stored in boxes tightly wrapped in stretch film.",
          "In all cases, the bakery cabinet must be closed tightly, as well as storage boxes in the back counter.",
          "It is preferred to order fresh bakery daily from the factory based on sales movement, or at most enough for 48 hours.",
          "If a customer requests heating, heat in the oven for 2 minutes at 180°C. The oven should be kept ready at 120°C in the early morning, and raised to 180°C for heating.",
          "Adhere strictly to all the above instructions."
        ],
        itemsAr: [
          "يتم إستلام كراتين البيكري بصفة يومية ويتم عرضها في كابينة البيكري.",
          "يتم تخزين باقي الكميات في الدرفة الخلفية من الكاونتر بعد غلق الكرتونة بالاسترتش.",
          "يتم رص البيكري في كابينة البيكري على أن يراعى البيع بنظام فيرست إن فيرست آوت.",
          "صلاحية البيكري في درجة حرارة الغرفة 48 ساعة وتصل إلى 72 ساعة عند تغليف الكراتين بالبلاستيك استريتش.",
          "في جميع الحالات يجب إغلاق كابينة البيكري جيداً وكذلك الكراتين في حالة التخزين في الكاونتر الخلفي مع تغليفها بالبلاستيك الاستريتش.",
          "يفضل طلب البيكري فريش يومياً من المصنع طبقاً لحركة المبيعات أو بحد أقصى ما يكفي مبيعات 48 ساعة.",
          "في حالة طلب العميل التسخين، يتم التسخين في الفرن لمدة دقيقتين عند 180 درجة مئوية على أن يراعى دائماً أن يكون الفرن جاهز للتشغيل عند 120 درجة مئوية في الصباح الباكر وعند إستخدامه في تسخين البيكري يتم رفع درجة الحرارة إلى 180 درجة مئوية.",
          "يراعي تنفيذ جميع التعليمات السابقة بكل دقة."
        ]
      }
    ]
  },
  {
    id: "pizza_instructions",
    categoryEn: "Pizza",
    categoryAr: "البيتزا",
    titleEn: "Pizza Operating Instructions",
    titleAr: "إجراءات تشغيل البيتزا",
    tags: ["pizza", "dough", "bake", "oven", "بيتزا", "فرن", "عجينة"],
    blocks: [
      {
        type: "list",
        itemsEn: [
          "Set the oven temperature to 250°C for the upper dial and 200°C for the lower dial. Bake the pizza for 5 to 7 minutes under continuous observation.",
          "Place the dough in the refrigerator for at least 6 hours before operating.",
          "Place pizza sauce and mozzarella cheese in the refrigerator for at least 6 hours before operating.",
          "Prepare the pizza pan and wipe it with enough olive oil to prevent sticking.",
          "Spread the dough using flour and place it in the designated pizza pan (dough shelf life in fridge is 3 days if stored properly).",
          "Spread the liquid sauce completely over the dough. For Margherita, place all mozzarella cheese. For other pizzas, place half the cheese on the sauce, add the meats/vegetables, then distribute the remaining cheese entirely on top.",
          "Place the pizza in the oven after ensuring it has reached the correct temperature.",
          "Bake for 5 to 7 minutes under continuous observation.",
          "Remove the pizza from the oven, cut it into 8 slices, and serve it on the wooden peel."
        ],
        itemsAr: [
          "يتم ضبط درجة حرارة الفرن 250 درجة للمؤشر العلوي و200 درجة للمؤشر السفلي وتتم تسوية البيتزا في خلال من 5 الى 7 دقائق تحت الملاحظة",
          "يتم وضع العجين في الثلاجة قبل التشغيل بمدة لا تقل عن 6 ساعات",
          "يتم وضع صوص البيتزا والجبنة الموتزريلا في الثلاجة قبل التشغيل بمدة لا تقل عن 6 ساعات",
          "يتم تجهيز صينية البيتزا ومسحها بزيت زيتون بكمية تمنع التصاق البيتزا بالصينية",
          "يتم فرد العجين بالدقيق ووضعه في الصينية المخصصة للبيتزا طبقاً للتشغيل الجديد وصلاحية العجين في الثلاجة 3 أيام بشرط الحفظ الجيد",
          "يتم وضع الصوص المسال وفرده على العجينة بالكامل ثم يتم وضع الجبنة الموتزريلا بالكامل في حالة البيتزا المارجريتا وفي حالة أي نوع بيتزا اخر يتم وضع نصف كمية الجبنة على الصوص ثم يتم وضع منتجات البيتزا الأخرى من لحوم وخضار ثم يتم توزيع باقي كمية الجبنة على البيتزا بالكامل",
          "يتم وضع البيتزا في الفرن بعد التأكد من تحقيقه درجة الحرارة",
          "تتم التسوية لمدة من 5 الى 7 دقائق مع الملاحظة المستمرة",
          "يتم اخراج البيتزا من الفرن وتقطع على 8 قطع وتقدم على المطرحة الخشب"
        ]
      }
    ]
  },
  {
    id: "pizza_recipes",
    categoryEn: "Pizza",
    categoryAr: "البيتزا",
    titleEn: "Pizza Recipes & Ingredients",
    titleAr: "الرسبي (المكونات للبيتزا)",
    tags: ["pizza", "recipe", "ingredients", "grams", "بيتزا", "مكونات", "رسبي", "جرام"],
    blocks: [
      {
        type: "recipe-table",
        tableData: [
          {
            nameEn: "Chicken Pizza",
            nameAr: "بيتزا فراخ",
            ingredients: [
              { nameEn: "Chicken Breast", nameAr: "صدور فراخ", qty: 70, unit: "g" },
              { nameEn: "Sliced Black Olives", nameAr: "زيتون اسود شرائح", qty: 20, unit: "g" },
              { nameEn: "Mozzarella Cheese", nameAr: "جبنة موتزريلا", qty: 150, unit: "g" },
              { nameEn: "Pizza Sauce", nameAr: "صوص بيتزا", qty: 50, unit: "g" },
              { nameEn: "Colored Peppers", nameAr: "فلفل الوان", qty: 40, unit: "g" },
              { nameEn: "Pizza Dough", nameAr: "عجينة بيتزا", qty: 250, unit: "g" }
            ]
          },
          {
            nameEn: "Hot Dog Pizza",
            nameAr: "بيتزا هوت دوج",
            ingredients: [
              { nameEn: "Hot Dog", nameAr: "هوت دوج", qty: 60, unit: "g" },
              { nameEn: "Sliced Black Olives", nameAr: "زيتون اسود شرائح", qty: 30, unit: "g" },
              { nameEn: "Mozzarella Cheese", nameAr: "جبنة موتزريلا", qty: 150, unit: "g" },
              { nameEn: "Pizza Sauce", nameAr: "صوص بيتزا", qty: 50, unit: "g" },
              { nameEn: "Pizza Dough", nameAr: "عجينة بيتزا", qty: 250, unit: "g" }
            ]
          },
          {
            nameEn: "Mushroom Pizza (Fungi)",
            nameAr: "بيتزا مشروم (فطنجي)",
            ingredients: [
              { nameEn: "Mushroom", nameAr: "مشروم", qty: 60, unit: "g" },
              { nameEn: "Mozzarella Cheese", nameAr: "جبنة موتزريلا", qty: 150, unit: "g" },
              { nameEn: "Pizza Sauce", nameAr: "صوص بيتزا", qty: 50, unit: "g" },
              { nameEn: "Pizza Dough", nameAr: "عجينة بيتزا", qty: 250, unit: "g" }
            ]
          },
          {
            nameEn: "Margherita Pizza",
            nameAr: "بيتزا مارجريتا",
            ingredients: [
              { nameEn: "Mozzarella Cheese", nameAr: "جبنة موتزريلا", qty: 150, unit: "g" },
              { nameEn: "Pizza Sauce", nameAr: "صوص بيتزا", qty: 50, unit: "g" },
              { nameEn: "Pizza Dough", nameAr: "عجينة بيتزا", qty: 250, unit: "g" }
            ]
          },
          {
            nameEn: "Super Supreme Pizza",
            nameAr: "بيتزا سوبر سوبريم",
            ingredients: [
              { nameEn: "Salami", nameAr: "سلامي", qty: 30, unit: "g" },
              { nameEn: "Roast Beef", nameAr: "روزبيف", qty: 30, unit: "g" },
              { nameEn: "Turkey", nameAr: "تركي", qty: 30, unit: "g" },
              { nameEn: "Pepperoni", nameAr: "ببروني", qty: 30, unit: "g" },
              { nameEn: "Mozzarella Cheese", nameAr: "جبنة موتزريلا", qty: 150, unit: "g" },
              { nameEn: "Pizza Sauce", nameAr: "صوص بيتزا", qty: 50, unit: "g" },
              { nameEn: "Pizza Dough", nameAr: "عجينة بيتزا", qty: 250, unit: "g" }
            ]
          },
          {
            nameEn: "Mix Cheese Pizza",
            nameAr: "بيتزا ميكس جبن",
            ingredients: [
              { nameEn: "Cheddar Cheese", nameAr: "جبنة شيدر", qty: 60, unit: "g" },
              { nameEn: "Roquefort Cheese", nameAr: "جبنة ريكفورد", qty: 20, unit: "g" },
              { nameEn: "Mozzarella Cheese", nameAr: "جبنة موتزريلا", qty: 150, unit: "g" },
              { nameEn: "Red Cheddar Cheese", nameAr: "جبنة شيدر احمر", qty: 40, unit: "g" },
              { nameEn: "Pizza Sauce", nameAr: "بيتزا صوص", qty: 50, unit: "g" },
              { nameEn: "Pizza Dough", nameAr: "عجينة بيتزا", qty: 250, unit: "g" }
            ]
          },
          {
            nameEn: "Pepperoni Pizza",
            nameAr: "بيتزا بيبيروني",
            ingredients: [
              { nameEn: "Pepperoni", nameAr: "بيبيروني", qty: 60, unit: "g" },
              { nameEn: "Mozzarella Cheese", nameAr: "جبنة موتزريلا", qty: 150, unit: "g" },
              { nameEn: "Pizza Sauce", nameAr: "صوص بيتزا", qty: 50, unit: "g" },
              { nameEn: "Pizza Dough", nameAr: "عجينة بيتزا", qty: 250, unit: "g" }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "expiry_tracker",
    categoryEn: "General",
    categoryAr: "عام",
    titleEn: "Food Products & Raw Materials Expiry Dates",
    titleAr: "تواريخ صلاحية منتجات وخامات الفود",
    tags: ["expiry", "dates", "shelf life", "validity", "صلاحية", "تواريخ", "منتجات"],
    blocks: [
      {
        type: "expiry-table",
        tableData: [
          { nameEn: "All Cold Cuts Sandwiches", nameAr: "جميع أنواع الساندوتشات الكولد كاتس", durationEn: "2 days from production date in display fridge (2-5°C) provided product quality is maintained", durationAr: "يومين من تاريخ الإنتاج في ثلاجة العرض (من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "Cold Cuts Sandwiches (Vacuum Packed)", nameAr: "الساندوتشات الكولد كاتس ( تغليف فاكيوم )", durationEn: "4 days from production date in display fridge (2-5°C) provided product quality is maintained", durationAr: "أربعة أيام من تاريخ الإنتاج في ثلاجة العرض (من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "All Club Sandwiches", nameAr: "جميع أنواع ساندوتشات الكلوب", durationEn: "2 days from production date in display fridge (2-5°C) provided product quality is maintained", durationAr: "يومين من تاريخ الإنتاج في ثلاجة العرض (من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "All Wrap Sandwiches", nameAr: "جميع أنواع ساندوتشات الراب", durationEn: "2 days from production date in display fridge (2-5°C) provided product quality is maintained", durationAr: "يومين من تاريخ الإنتاج في ثلاجة العرض (من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "All Salads", nameAr: "جميع أنواع السلطات", durationEn: "2 days from production date in display fridge (2-5°C) provided product quality is maintained", durationAr: "يومين من تاريخ الإنتاج في ثلاجة العرض (من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "All Hot Meals", nameAr: "جميع أصناف الوجبات الساخنة", durationEn: "4 days from production date (2-5°C) provided product quality is maintained", durationAr: "أربعة أيام من تاريخ الانتاج (من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "All Sweets/Cakes", nameAr: "جميع أصناف الحلويات ( الكيك )", durationEn: "4 days from production date in display fridge (2-5°C) provided product quality is maintained", durationAr: "أربعة أيام من تاريخ الانتاج في ثلاجة العرض (من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "All Mousse Cakes", nameAr: "جميع أصناف كيك الموس", durationEn: "4 days from production date in display fridge (2-5°C) provided product quality is maintained", durationAr: "أربعة أيام من تاريخ الانتاج في ثلاجة العرض (من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "All Fresh Juices", nameAr: "جميع أصناف العصير الفريش", durationEn: "6 months from production date in freezer (-18°C) & 3 days in display fridge (2-5°C) provided product quality is maintained", durationAr: "ستة شهور من تاريخ الانتاج في الفريزر ( -18 درجة مئوية ) & ثلاثة أيام في ثلاجة العرض (من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "All Fresh Lemon Juices", nameAr: "جميع أصناف العصير الفريش (الليمون)", durationEn: "6 months from production date in freezer (-18°C) & 3 days in display fridge (2-5°C) provided product quality is maintained", durationAr: "ستة شهور من تاريخ الانتاج في الفريزر ( -18 درجة مئوية ) & ثلاثة أيام في ثلاجة العرض (من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "All Croissants", nameAr: "جميع أصناف الكرواسون", durationEn: "1 day from production date in display cabinet (provided product quality is maintained) & 3 days wrapped in box in well-ventilated area", durationAr: "يوم من تاريخ الانتاج في كابينة العرض ( بشرط جودة المنتج ) & 3 أيام في الكرتونة مغلقة باسترتش في مكان جيد التهوية باللاين" },
          { nameEn: "All Pate", nameAr: "جميع أصناف الباتيه", durationEn: "1 day from production date in display cabinet (provided product quality is maintained) & 3 days wrapped in box in well-ventilated area", durationAr: "يوم من تاريخ الانتاج في كابينة العرض ( بشرط جودة المنتج ) & 3 أيام في الكرتونة مغلقة باسترتش في مكان جيد التهوية باللاين" },
          { nameEn: "Cinnamon Roll", nameAr: "السينامون رول", durationEn: "1 day in display cabinet (provided product quality is maintained) & 3 days wrapped in box in well-ventilated area", durationAr: "يوم في كابينة العرض ( بشرط جودة المنتج ) & 3 أيام في الكرتونة مغلقة باسترتش في مكان جيد التهوية باللاين" },
          { nameEn: "All Muffins", nameAr: "جميع أصناف المافن", durationEn: "1 day in display cabinet (provided product quality is maintained) & 7 days wrapped in box in well-ventilated area", durationAr: "يوم في كابينة العرض ( بشرط جودة المنتج ) & 7 أيام في الكرتونة مغلقة باسترتش في مكان جيد التهوية باللاين" },
          { nameEn: "All Cookies", nameAr: "جميع أنواع الكوكيز", durationEn: "14 days from production date at line temperature (20-22°C) provided product quality is maintained", durationAr: "أربعة عشر يوما من تاريخ الانتاج في درجة حرارة اللاين (من 20-22 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "Pizza Dough", nameAr: "عجينة البيتزا", durationEn: "1 month from production date in freezer (-18°C) & 1 day in fridge (2-5°C) after thawing", durationAr: "شهر من تاريخ الانتاج في الفريزر ( -18 درجة مئوية ) & يوم واحد في الثلاجة (من 2-5 درجة مئوية) بعد الإذابة" },
          { nameEn: "Mozzarella Cheese", nameAr: "جبنة موتزاريلا", durationEn: "1 month from production date in freezer (-18°C)", durationAr: "شهر من تاريخ الانتاج في الفريزر ( -18 درجة مئوية )" },
          { nameEn: "Pizza Sauce", nameAr: "صلصة البيتزا", durationEn: "1 month from production date in freezer (-18°C) & 1 day in fridge (2-5°C)", durationAr: "شهر من تاريخ الانتاج في الفريزر ( -18 درجة مئوية ) & يوم واحد في الثلاجة (من 2-5 درجة مئوية)" },
          { nameEn: "Smoked Turkey & Smoked Chicken", nameAr: "تركي مدخن & دجاج مدخن", durationEn: "3 months in freezer (-18°C) & 2-3 days in fridge (2-5°C)", durationAr: "ثلاث شهور في الفريزر من تاريخ الانتاج ( -18 درجة مئوية ) & يومين أو 3 أيام في الثلاجة (من 2-5 درجة مئوية)" },
          { nameEn: "Salami & Roast Beef & Pepperoni", nameAr: "سلامي & روست بيف & بيبروني", durationEn: "3 months in freezer (-18°C) & 2-3 days in fridge (2-5°C)", durationAr: "ثلاث شهور في الفريزر من تاريخ الانتاج ( -18 درجة مئوية ) & ليومين أو 3 أيام في الثلاجة (من 2-5 درجة مئوية)" },
          { nameEn: "Beef Sausage", nameAr: "سجق بقري", durationEn: "1 month in freezer (-18°C) & 3 days in fridge (2-5°C)", durationAr: "شهر من تاريخ الانتاج في الفريزر ( -18 درجة مئوية ) & ثلاثة أيام في الثلاجة (من 2-5 درجة مئوية)" },
          { nameEn: "Pastrami", nameAr: "بسطرمة", durationEn: "3 months in freezer (-18°C) & 3 days in fridge (2-5°C)", durationAr: "ثلاثة شهور من تاريخ الانتاج في الفريزر ( -18 درجة مئوية ) & ثلاثة أيام في الثلاجة (من 2-5 درجة مئوية)" },
          { nameEn: "Tuna", nameAr: "تونة", durationEn: "Before opening: Expiry date on can. After opening: 1 day in fridge (2-5°C)", durationAr: "قبل الفتح: تاريخ الصلاحية المدون على العلبة & بعد الفتح: يوم في الثلاجة (من 2-5 درجة مئوية)" },
          { nameEn: "Anchovies", nameAr: "الأنشوجة", durationEn: "Before opening: Expiry date on can. After opening: 1 day in fridge (2-5°C)", durationAr: "قبل الفتح: تاريخ الصلاحية المدون على العلبة & بعد الفتح: يوم في الثلاجة (من 2-5 درجة مئوية)" },
          { nameEn: "Mushroom", nameAr: "المشروم", durationEn: "Before opening: Expiry date on can. After opening: 3 days in fridge (2-5°C)", durationAr: "قبل الفتح: تاريخ الصلاحية المدون على العلبة & بعد الفتح: ثلاثة أيام في الثلاجة (من 2-5 درجة مئوية)" },
          { nameEn: "Yellow Cheddar", nameAr: "شيدر أصفر", durationEn: "7 days from production date in fridge (2-5°C)", durationAr: "سبعة أيام من تاريخ الانتاج في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "Red Edge Cheddar", nameAr: "شيدر أطراف أحمر", durationEn: "7 days from production date in fridge (2-5°C)", durationAr: "سبعة أيام من تاريخ الانتاج في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "Roquefort Cheese", nameAr: "جبنة ريكفورد", durationEn: "7 days from production date in fridge (2-5°C)", durationAr: "سبعة أيام من تاريخ الانتاج في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "Zucchini & Eggplant & Colored Peppers", nameAr: "كوسة & باذنجان رومي & فلفل ألوان", durationEn: "7 days from production date in fridge (2-5°C)", durationAr: "سبعة أيام من تاريخ الانتاج في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "Black Olives", nameAr: "زيتون أسود", durationEn: "Before opening: Expiry date on can. After opening: 3 days in fridge (2-5°C)", durationAr: "قبل الفتح: تاريخ الصلاحية المدون على العلبة & بعد الفتح: ثلاثة أيام في الثلاجة (من 2-5 درجة مئوية)" },
          { nameEn: "Burger", nameAr: "البرجر", durationEn: "1 month in freezer (-18°C) & 3 days in food fridge after thawing provided product quality is maintained", durationAr: "شهر من تاريخ الانتاج في الفريزر ( -18 درجة مئوية ) & 3 أيام في ثلاجة الفود بعد الاذابة بشرط جودة المنتج" },
          { nameEn: "Hot Dog", nameAr: "الهوت دوج", durationEn: "3 months in freezer (-18°C) & 3 days in fridge (2-5°C) provided product quality is maintained", durationAr: "ثلاثة شهور من تاريخ الانتاج في الفريزر ( -18 درجة مئوية ) & 3 أيام في ثلاجة (من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "French Fries", nameAr: "الفرنش فرايز", durationEn: "Expiry date on bag in freezer (-18°C)", durationAr: "تاريخ الانتهاء المدون على الكيس في الفريزر (-18 درجة مئوية)" },
          { nameEn: "Burger Bun & Hot Dog Bun", nameAr: "عيش البرجر وعيش الهوت دوج", durationEn: "1 month in freezer & 3 days in fridge (2-5°C)", durationAr: "شهر في الفريزر من تاريخ الانتاج & 3 أيام في ثلاجة الفود ( من 2-5 درجة مئوية)" },
          { nameEn: "Marley Sliced Cheese", nameAr: "جبنة مارلي أسلايس", durationEn: "Expiry date on bag in fridge (2-5°C)", durationAr: "تاريخ الانتهاء المدون على الكيس في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "Burger Sauce", nameAr: "صوص البرجر", durationEn: "1 month in food fridge (2-5°C) provided product quality is maintained", durationAr: "شهر في ثلاجة الفود ( من 2-5 درجة مئوية) بشرط جودة المنتج" },
          { nameEn: "Jalapeno", nameAr: "هالبينو", durationEn: "Before opening: Expiry date on can. After opening: 3 days in fridge (2-5°C)", durationAr: "قبل الفتح: تاريخ الصلاحية المدون على العلبة & بعد الفتح: 3 أيام في الثلاجة (من 2-5 درجة مئوية)" },
          { nameEn: "Shredded Lettuce - Vacuum", nameAr: "خس شريدت - فاكيوم", durationEn: "4 days from production date in fridge (2-5°C)", durationAr: "أربعة أيام من تاريخ الانتاج في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "Iceberg Lettuce", nameAr: "خس كابوتشا", durationEn: "7 days from production date in fridge (2-5°C)", durationAr: "سبعة أيام من تاريخ الانتاج في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "Fava Beans", nameAr: "فول", durationEn: "1 month in freezer (-18°C) & 3 days in fridge for operation (2-5°C)", durationAr: "شهر من تاريخ الانتاج في الفريزر (-18 درجة مئوية) & ثلاثة أيام في ثلاجة الفود للتشغيل ( من 2-5 درجة مئوية)" },
          { nameEn: "Shami Bread", nameAr: "عيش شامي", durationEn: "1 month in freezer (-18°C) & 3 days in fridge (2-5°C)", durationAr: "شهر من تاريخ الانتاج في الفريزر (-18 درجة مئوية) & ثلاثة أيام في ثلاجة الفود ( من 2-5 درجة مئوية)" },
          { nameEn: "Butter", nameAr: "زبدة", durationEn: "According to expiry date on package in fridge (2-5°C)", durationAr: "طبقاً لتاريخ الانتهاء المدون على العبوة في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "Eggs", nameAr: "بيض", durationEn: "15 days in food fridge (2-5°C) & 1 day at room temp for operation (20-22°C)", durationAr: "خمسة عشر يوماً في ثلاجة الفود (من 2-5 درجة مئوية) & يوم في درجة حرارة الغرفة للتشغيل ( من 20-22 درجة مئوية)" },
          { nameEn: "Pickles", nameAr: "مخلل طرشي", durationEn: "Before opening: Expiry date on can. After opening: in fridge (2-5°C)", durationAr: "قبل الفتح: تاريخ الصلاحية المدون على العلبة & بعد الفتح: في الثلاجة (من 2-5 درجة مئوية)" },
          { nameEn: "Ketchup", nameAr: "الكاتشب", durationEn: "Expiry date on package in fridge (2-5°C) & in squeeze bottle 3 days in fridge (2-5°C)", durationAr: "تاريخ الصلاحية المدون على العبوة في الثلاجة ( من 2-5 درجة مئوية) & في الاسكويز ثلاثة أيام في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "Mayonnaise", nameAr: "المايونيز", durationEn: "Expiry date on package in fridge (2-5°C) & in squeeze bottle 3 days in fridge (2-5°C)", durationAr: "تاريخ الصلاحية المدون على العبوة في الثلاجة ( من 2-5 درجة مئوية) & في الاسكويز ثلاثة أيام في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "BBQ Sauce", nameAr: "الباربيكيو", durationEn: "Expiry date on package in fridge (2-5°C) & in squeeze bottle 3 days in fridge (2-5°C)", durationAr: "تاريخ الصلاحية المدون على العبوة في الثلاجة ( من 2-5 درجة مئوية) & في الاسكويز ثلاثة أيام في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "Mustard", nameAr: "الماستردة", durationEn: "According to expiry date on package in fridge (2-5°C) & in squeeze bottle 3 days in fridge (2-5°C)", durationAr: "طبقاً لتاريخ الصلاحية المدون على العبوة في الثلاجة ( من 2-5 درجة مئوية) & في الاسكويز ثلاثة أيام في الثلاجة ( من 2-5 درجة مئوية)" },
          { nameEn: "Tahini", nameAr: "الطحينة", durationEn: "3 days in fridge (2-5°C) after preparation", durationAr: "ثلاثة أيام في الثلاجة ( من 2-5 درجة مئوية ) بعد التحضير" },
          { nameEn: "Coleslaw", nameAr: "الكول سلو", durationEn: "Total expiry 10 days from production date provided product quality is maintained with changing expiry every 3 days", durationAr: "اجمالي الصلاحية 10 أيام من تاريخ الانتاج بشرط جودة المنتج مع تغير الصلاحية كل 3 أيام" },
          { nameEn: "Fresh Orange Juice - Juicer", nameAr: "عصير البرتقال الفريش ( عصارة البرتقال )", durationEn: "Before juicing: Expiry date on box / or 15 days for display (and 2 days after juicing in fridge (2-5°C) provided quality is maintained)", durationAr: "قبل العصر: تاريخ الصلاحية المدون على الكرتونة / أو 15 يوم للعرض ( ويومين بعد العصر في الثلاجة ( من 2-5 درجة مئوية ) بشرط الجودة" }
        ]
      }
    ]
  }
];
