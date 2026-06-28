import { PrismaClient, Role, TableStatus, Permission } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      name: "Admin",
      role: Role.ADMIN,
      username: "admin",
      password: adminPassword,
      active: true,
    },
  });
  console.log("✅ Admin created:", admin.name);

  // Create waiter accounts
  const ahmed = await prisma.user.upsert({
    where: { username: "ahmed" },
    update: {},
    create: {
      name: "Ahmed",
      role: Role.WAITER,
      username: "ahmed",
      pin: "1234",
      active: true,
    },
  });
  console.log("✅ Waiter created:", ahmed.name);

  const fatima = await prisma.user.upsert({
    where: { username: "fatima" },
    update: {},
    create: {
      name: "Fatima",
      role: Role.WAITER,
      username: "fatima",
      pin: "5678",
      active: true,
    },
  });
  console.log("✅ Waiter created:", fatima.name);

  const omar = await prisma.user.upsert({
    where: { username: "omar" },
    update: {},
    create: {
      name: "Omar",
      role: Role.WAITER,
      username: "omar",
      pin: "9012",
      active: true,
    },
  });
  console.log("✅ Waiter created:", omar.name);

  // Create cashier account
  const cashier = await prisma.user.upsert({
    where: { username: "cashier" },
    update: {},
    create: {
      name: "Cashier",
      role: Role.CASHIER,
      username: "cashier",
      pin: "0000",
      active: true,
      permissions: [
        Permission.CANCEL_ORDER,
        Permission.SETTLE_BILL,
        Permission.VIEW_REPORTS,
        Permission.CLOSE_SHIFT,
      ],
    },
  });
  console.log("✅ Cashier created:", cashier.name);

  // Create tables
  const tableNames = [
    "Table 1",
    "Table 2",
    "Table 3",
    "Table 4",
    "Table 5",
    "Table 6",
    "Table 7",
    "Table 8",
    "VIP 1",
    "VIP 2",
    "Bar 1",
    "Bar 2",
  ];

  for (const name of tableNames) {
    await prisma.table.upsert({
      where: { id: name.toLowerCase().replace(" ", "-") },
      update: {},
      create: {
        id: name.toLowerCase().replace(" ", "-"),
        name,
        status: TableStatus.AVAILABLE,
      },
    });
  }
  console.log(`✅ ${tableNames.length} tables created`);

  // Create categories
  const categories = [
    { name: "Burgers", description: "Juicy beef and chicken burgers", sortOrder: 1 },
    { name: "Pizza", description: "Stone-baked pizzas", sortOrder: 2 },
    { name: "Chicken", description: "Crispy fried chicken", sortOrder: 3 },
    { name: "Sides", description: "Fries, onion rings & more", sortOrder: 4 },
    { name: "Drinks", description: "Soft drinks and juices", sortOrder: 5 },
    { name: "Desserts", description: "Sweet treats", sortOrder: 6 },
  ];

  const createdCategories: Record<string, string> = {};
  for (const cat of categories) {
    const existing = await prisma.category.findFirst({ where: { name: cat.name } });
    if (existing) {
      createdCategories[cat.name] = existing.id;
    } else {
      const created = await prisma.category.create({ data: cat });
      createdCategories[cat.name] = created.id;
    }
  }
  console.log(`✅ ${categories.length} categories created`);

  // Create menu items
  const menuItems = [
    // Burgers
    { name: "Classic Burger", price: 8.99, description: "Beef patty, lettuce, tomato, pickles", categoryName: "Burgers" },
    { name: "Cheese Burger", price: 9.99, description: "Beef patty with melted cheddar", categoryName: "Burgers" },
    { name: "Double Burger", price: 12.99, description: "Double beef patty, double cheese", categoryName: "Burgers" },
    { name: "Chicken Burger", price: 9.49, description: "Crispy chicken fillet with mayo", categoryName: "Burgers" },
    { name: "BBQ Burger", price: 10.99, description: "Smoky BBQ sauce, onion rings, bacon", categoryName: "Burgers" },
    { name: "Veggie Burger", price: 8.49, description: "Plant-based patty with fresh veggies", categoryName: "Burgers" },

    // Pizza
    { name: "Margherita", price: 11.99, description: "Tomato sauce, mozzarella, basil", categoryName: "Pizza" },
    { name: "Pepperoni", price: 13.99, description: "Loaded with pepperoni slices", categoryName: "Pizza" },
    { name: "BBQ Chicken Pizza", price: 14.99, description: "BBQ sauce, grilled chicken, peppers", categoryName: "Pizza" },
    { name: "Veggie Supreme", price: 12.99, description: "Mixed vegetables on tomato base", categoryName: "Pizza" },
    { name: "Four Cheese", price: 14.49, description: "Mozzarella, cheddar, parmesan, gouda", categoryName: "Pizza" },

    // Chicken
    { name: "Fried Chicken (2pc)", price: 7.99, description: "Crispy Southern fried chicken", categoryName: "Chicken" },
    { name: "Fried Chicken (4pc)", price: 13.99, description: "Family portion crispy chicken", categoryName: "Chicken" },
    { name: "Chicken Strips (5pc)", price: 8.99, description: "Tender chicken strips with dip", categoryName: "Chicken" },
    { name: "Chicken Wings (8pc)", price: 11.99, description: "Spicy buffalo wings", categoryName: "Chicken" },
    { name: "Grilled Chicken", price: 10.99, description: "Herb-marinated grilled chicken", categoryName: "Chicken" },

    // Sides
    { name: "French Fries", price: 3.49, description: "Golden crispy fries", categoryName: "Sides" },
    { name: "Large Fries", price: 4.49, description: "Extra large portion of fries", categoryName: "Sides" },
    { name: "Onion Rings", price: 3.99, description: "Crispy battered onion rings", categoryName: "Sides" },
    { name: "Coleslaw", price: 2.49, description: "Creamy homemade coleslaw", categoryName: "Sides" },
    { name: "Mozzarella Sticks", price: 5.99, description: "Fried mozzarella with marinara", categoryName: "Sides" },

    // Drinks
    { name: "Cola (M)", price: 2.49, description: "Medium cold cola", categoryName: "Drinks" },
    { name: "Cola (L)", price: 2.99, description: "Large cold cola", categoryName: "Drinks" },
    { name: "Orange Juice", price: 3.49, description: "Fresh squeezed orange juice", categoryName: "Drinks" },
    { name: "Lemonade", price: 3.49, description: "Fresh homemade lemonade", categoryName: "Drinks" },
    { name: "Water", price: 1.49, description: "Still or sparkling water", categoryName: "Drinks" },
    { name: "Milkshake", price: 4.99, description: "Chocolate, vanilla or strawberry", categoryName: "Drinks" },
    { name: "Iced Tea", price: 2.99, description: "Refreshing iced tea", categoryName: "Drinks" },

    // Desserts
    { name: "Chocolate Brownie", price: 4.99, description: "Warm brownie with ice cream", categoryName: "Desserts" },
    { name: "Ice Cream (2 scoops)", price: 3.99, description: "Choice of flavors", categoryName: "Desserts" },
    { name: "Apple Pie", price: 4.49, description: "Classic warm apple pie", categoryName: "Desserts" },
    { name: "Cheesecake", price: 5.49, description: "New York style cheesecake", categoryName: "Desserts" },
  ];

  for (const item of menuItems) {
    const { categoryName, ...itemData } = item;
    const categoryId = createdCategories[categoryName];
    const existing = await prisma.menuItem.findFirst({
      where: { name: item.name, categoryId },
    });
    if (!existing) {
      await prisma.menuItem.create({
        data: { ...itemData, categoryId, available: true },
      });
    }
  }
  console.log(`✅ ${menuItems.length} menu items created`);

  // Create default payment methods
  const defaultPaymentMethods = [
    { name: "Cash",  code: "CASH",  icon: "Banknote",   color: "text-green-600",  sortOrder: 1 },
    { name: "Sahal", code: "SAHAL", icon: "Smartphone", color: "text-blue-600",   sortOrder: 2 },
    { name: "EVC",   code: "EVC",   icon: "Smartphone", color: "text-purple-600", sortOrder: 3 },
    { name: "Card",  code: "CARD",  icon: "CreditCard", color: "text-orange-600", sortOrder: 4 },
    { name: "Customer Credit", code: "CUSTOMER_CREDIT", icon: "Users", color: "text-red-600", sortOrder: 5 },
  ];
  for (const pm of defaultPaymentMethods) {
    await prisma.paymentMethodConfig.upsert({
      where: { code: pm.code },
      update: {},
      create: pm,
    });
  }
  console.log(`✅ ${defaultPaymentMethods.length} payment methods created`);

  // Create default settings
  const settings = await prisma.settings.findFirst();
  if (!settings) {
    await prisma.settings.create({
      data: {
        restaurantName: "Smart POS Restaurant",
        currency: "USD",
        currencySymbol: "$",
        tax: 8,
        receiptFooter: "Thank you for dining with us!",
        address: "123 Main Street, City",
        phone: "+1 (555) 123-4567",
      },
    });
    console.log("✅ Default settings created");
  }

  console.log("🎉 Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
