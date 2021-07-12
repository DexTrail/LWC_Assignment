/**
 * Created by Dmitry Ivakhnenko on 04-Jul-2021.
 */

@IsTest
private class Test_OrderProductsController {

    @IsTest
    static void getOrder_NoRecords() {
        TestData.loadTestData();

        Order order = [SELECT Id FROM Order WHERE Name = 'Order2'];
        Test.startTest();
        order = OrderProductsController.getOrder(order.Id);
        Test.stopTest();
        System.assert(order.OrderItems.isEmpty());
    }

    @IsTest
    static void getOrder_HaveRecords() {
        TestData.loadTestData();

        Order order = [SELECT Id FROM Order WHERE Name = 'Order1'];
        Test.startTest();
        order = OrderProductsController.getOrder(order.Id);
        Test.stopTest();
        System.assertEquals(2, order.OrderItems.size());
    }

    @IsTest
    static void queueSaveOrderItems_EmptyLists() {
        TestData.loadTestData();

        List<OrderItem> orderItems = [SELECT Id FROM OrderItem];
        delete orderItems;
        Order order = [SELECT Id FROM Order WHERE Name = 'Order1'];

        List<OrderItem> orderItemsToUpsert = new List<OrderItem>();
        List<OrderItem> orderItemsToDelete = new List<OrderItem>();

        Test.startTest();
        OrderProductsController.queueSaveOrderItems(order.Id, orderItemsToUpsert, orderItemsToDelete);
        Test.stopTest();

        orderItems = [SELECT Id FROM OrderItem];
        System.assert(orderItems.isEmpty());
    }

    @IsTest
    static void queueSaveOrderItems_UpsertOnly() {
        TestData.loadTestData();

        List<OrderItem> orderItemsToDelete = new List<OrderItem>();
        List<OrderItem> orderItemsToUpsert = new List<OrderItem>();

        OrderItem orderItem = [SELECT OrderId, Quantity, Product2Id, UnitPrice FROM OrderItem WHERE UnitPrice = 15];
        orderItem.Id = null;  // Simulate new product from front-end
        orderItem.Quantity = 11;
        orderItemsToUpsert.add(orderItem);

        Product2 product = [SELECT Id FROM Product2 WHERE Name = 'Product1'];
        PricebookEntry pricebookEntry = [SELECT Id FROM PricebookEntry WHERE UnitPrice = 1];
        orderItemsToUpsert.add(new OrderItem(OrderId=orderItem.OrderId, Product2Id=product.Id, PricebookEntryId=pricebookEntry.Id,
                Quantity=37, UnitPrice=1));

        Test.startTest();
        OrderProductsController.queueSaveOrderItems(orderItem.OrderId, orderItemsToUpsert, orderItemsToDelete);
        Test.stopTest();

        List<OrderItem> orderItems = [SELECT Quantity, UnitPrice FROM OrderItem WHERE OrderId = :orderItem.OrderId];
        System.assertEquals(3, orderItems.size());

        for (OrderItem item : orderItems) {
            switch on String.valueOf(item.UnitPrice) {
                when '1.00' {
                    System.assertEquals(37, item.Quantity);
                }
                when '10.00' {
                    System.assertEquals(2, item.Quantity);
                }
                when '15.00' {
                    System.assertEquals(11, item.Quantity);
                }
                when else {
                    throw new AssertException('Incorrect Quantity ' + item.Quantity + ' for Order Item with UnitPrice ' + item.UnitPrice);
                }
            }
        }
    }

    @IsTest
    static void saveOrderItems_DeleteOnly() {
        TestData.loadTestData();

        List<OrderItem> orderItemsToUpsert = new List<OrderItem>();
        List<OrderItem> orderItemsToDelete = new List<OrderItem>();
        OrderItem orderItem = [SELECT OrderId, Quantity, Product2Id, UnitPrice FROM OrderItem WHERE UnitPrice = 15];
        orderItemsToDelete.add(orderItem);

        Test.startTest();
        OrderProductsController.queueSaveOrderItems(orderItem.OrderId, orderItemsToUpsert, orderItemsToDelete);
        Test.stopTest();

        List<OrderItem> orderItems = [SELECT Id FROM OrderItem WHERE Id = :orderItem.Id];
        System.assert(orderItems.isEmpty());
    }

    @IsTest
    static void confirmOrder_Test() {
        TestData.loadTestData();
        Test.setMock(HttpCalloutMock.class, new OrderHttpCalloutMock());

        Order order = [SELECT Id FROM Order WHERE Name = 'Order1'];
        Test.startTest();
        Boolean orderConfirmed = OrderProductsController.confirmOrder(order.Id);
        Test.stopTest();

        System.assertEquals(true, orderConfirmed);
    }

    @IsTest
    static void getSaveAsyncStatus_Coverage() {  // Can't test queued saves
        Datetime timestamp = Datetime.now();

        Test.startTest();
        String status = OrderProductsController.getSaveAsyncStatus(timestamp);
        Test.stopTest();

        System.assertEquals('Completed', status);
    }


    private class OrderHttpCalloutMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            return response;
        }
    }
}