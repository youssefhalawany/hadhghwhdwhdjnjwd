export type SOPCategory = 'Bakery' | 'Pizza' | 'General';

export interface SOPBlock {
  type: 'text' | 'warning' | 'list' | 'recipe-table' | 'highlight';
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
  }
];
