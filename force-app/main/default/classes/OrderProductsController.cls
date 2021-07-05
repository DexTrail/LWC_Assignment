/**
 * Created by Dmitry Ivakhnenko on 29-Jun-2021.
 */

public with sharing class OrderProductsController {

    @AuraEnabled(Cacheable=true)
    public static List<OrderItem> getOrderItems(Id orderId) {
        if (orderId == null) throw new AuraHandledException('getOrderItems(): orderId can\'t be null');

        List<OrderItem> orderItems = [
                SELECT Product2.Name, Quantity, TotalPrice, UnitPrice, OrderId, PricebookEntryId
                FROM OrderItem
                WHERE OrderId = :orderId
                ORDER BY Product2.Name
        ];
        return orderItems;
    }

    @AuraEnabled
    public static List<OrderItem> saveOrderItems(List<OrderItem> orderItemsToUpsert, List<OrderItem> orderItemsToDelete) {
        Savepoint sp = Database.setSavepoint();
        try {
            if (orderItemsToUpsert != null && !orderItemsToUpsert.isEmpty()) upsert orderItemsToUpsert;
            if (orderItemsToDelete != null && !orderItemsToDelete.isEmpty()) delete orderItemsToDelete;
        } catch (Exception ex) {
            Database.rollback(sp);
            System.debug(System.LoggingLevel.ERROR, ex.getMessage());
            throw ex;
        }
        return orderItemsToUpsert;
    }
}