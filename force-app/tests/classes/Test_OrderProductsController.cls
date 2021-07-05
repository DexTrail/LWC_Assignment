/**
 * Created by Dmitry Ivakhnenko on 04-Jul-2021.
 */

@IsTest
private class Test_OrderProductsController {

    @IsTest
    static void getOrderItems_NoRecords() {
        TestData.loadTestData();

        Order order = [SELECT Id FROM Order WHERE Name = 'Order2'];
        Test.startTest();
        List<OrderItem> orderItems = OrderProductsController.getOrderItems(order.Id);
        Test.stopTest();
        System.assert(orderItems.isEmpty());
    }

    @IsTest
    static void getOrderItems_HaveRecords() {
        TestData.loadTestData();

        Order order = [SELECT Id FROM Order WHERE Name = 'Order1'];
        Test.startTest();
        List<OrderItem> orderItems = OrderProductsController.getOrderItems(order.Id);
        Test.stopTest();
        System.assertEquals(2, orderItems.size());
    }

    @IsTest
    static void saveOrderItems_EmptyLists() {
        List<OrderItem> orderItemsToUpsert = new List<OrderItem>();
        List<OrderItem> orderItemsToDelete = new List<OrderItem>();

        Test.startTest();
        List<OrderItem> orderItems = OrderProductsController.saveOrderItems(orderItemsToUpsert, orderItemsToDelete);
        Test.stopTest();

        System.assert(orderItems.isEmpty());
        orderItems = [SELECT Id FROM OrderItem];
        System.assert(orderItems.isEmpty());
    }

    @IsTest
    static void saveOrderItems_UpsertOnly() {
        TestData.loadTestData();

        List<OrderItem> orderItemsToDelete = new List<OrderItem>();
        List<OrderItem> orderItemsToUpsert = new List<OrderItem>();
        OrderItem orderItem = [SELECT OrderId, Quantity, UnitPrice FROM OrderItem WHERE UnitPrice = 15];
        orderItem.Quantity = 7;
        orderItem.UnitPrice = 11;
        orderItemsToUpsert.add(orderItem);

        Product2 product = [SELECT Id FROM Product2 WHERE Name = 'Product1'];
        PricebookEntry pricebookEntry = [SELECT Id FROM PricebookEntry WHERE UnitPrice = 1];
        orderItemsToUpsert.add(new OrderItem(OrderId=orderItem.OrderId, Product2Id=product.Id, PricebookEntryId=pricebookEntry.Id,
                Quantity=37, UnitPrice=1));

        Test.startTest();
        List<OrderItem> orderItems = OrderProductsController.saveOrderItems(orderItemsToUpsert, orderItemsToDelete);
        Test.stopTest();

        System.assertEquals(2, orderItems.size());

        orderItem = [SELECT Quantity FROM OrderItem WHERE UnitPrice = 11];
        System.assertEquals(7, orderItem.Quantity);

        orderItem = [SELECT UnitPrice FROM OrderItem WHERE Quantity = 37];
        System.assertEquals(1, orderItem.UnitPrice);
    }

    @IsTest
    static void saveOrderItems_DeleteOnly() {
        TestData.loadTestData();

        List<OrderItem> orderItemsToUpsert = new List<OrderItem>();
        List<OrderItem> orderItemsToDelete = new List<OrderItem>();
        OrderItem orderItem = [SELECT OrderId, Quantity, UnitPrice FROM OrderItem WHERE UnitPrice = 15];
        orderItemsToDelete.add(orderItem);

        Test.startTest();
        List<OrderItem> orderItems = OrderProductsController.saveOrderItems(orderItemsToUpsert, orderItemsToDelete);
        Test.stopTest();

        System.assert(orderItems.isEmpty());

        orderItems = [SELECT Id FROM OrderItem WHERE Id = :orderItem.Id];
        System.assert(orderItems.isEmpty());
    }
}