/**
 * Created by Dmitry Ivakhnenko on 29-Jun-2021.
 */

public with sharing class OrderProductsController {

    // This can be put in custom settings or custom metadata
    private static final String CONFIRM_ENDPOINT = 'https://pentagone.requestcatcher.com/';
    private static final Integer CONFIRM_TIMEOUT = 10000;

    @AuraEnabled(Cacheable=true)
    public static Order getOrder(Id orderId) {
        if (orderId == null) throw new AuraHandledException('getOrder(): orderId can\'t be null');

        Order order = [
                SELECT Contract.Status, Status, (
                        SELECT Product2.Name, Quantity, TotalPrice, UnitPrice, OrderId, PricebookEntryId
                        FROM OrderItems
                )
                FROM Order
                WHERE Id = :orderId
        ]?.get(0);
        return order;
    }

    /* This method can be synchronous because we don't want user to do something
       while we don't know if the Order confirmed (and blocked) or not */
    @AuraEnabled
    public static Boolean confirmOrder(Id orderId) {
        Boolean orderConfirmed = false;
        /* It's possible query all fields we need in getOrder(), create body in JS and pass it with all params here.
           But user can keep tab opened for a long time and some records can be changed
           by someone else (Account Number for example). It's better to query fresh info
           before sending request to confirm and Activated the order */
        Order order = getOrderToConfirm(orderId);
        String requestBody = generateRequestBody(order);

        Http http = new Http();
        HttpRequest httpRequest = new HttpRequest();
        httpRequest.setEndpoint(CONFIRM_ENDPOINT);
        httpRequest.setMethod('POST');
        httpRequest.setHeader('Content-Type', 'application/json;charset=UTF-8');
        httpRequest.setBody(requestBody);
        httpRequest.setTimeout(CONFIRM_TIMEOUT);

        HttpResponse httpResponse = new HttpResponse();
        try {
            httpResponse = http.send(httpRequest);

            if (httpResponse.getStatusCode() == 200) {
                order.Status = 'Activated';
                update order;
                orderConfirmed = true;
            }
        } catch (Exception ex) {
            System.debug(System.LoggingLevel.ERROR, ex);
            /* Replace error message text for user.
               Maybe handling only 'Read timed out' message this way would be better? */
            if (ex.getTypeName() == 'System.CalloutException') {
                throw new AuraHandledException('Unable to confirm order. Try again later');
            } else {
                throw ex;
            }
        }
        return orderConfirmed;
    }

    /* Works nice in synchronous saves too */
    @AuraEnabled
    public static void saveOrderItems(List<OrderItem> orderItemsToUpsert, List<OrderItem> orderItemsToDelete) {
        Savepoint sp = Database.setSavepoint();
        try {
            if (orderItemsToDelete != null && !orderItemsToDelete.isEmpty()) delete orderItemsToDelete;
            if (orderItemsToUpsert != null && !orderItemsToUpsert.isEmpty()) upsert orderItemsToUpsert;
            //throw new AuraHandledException('SOME DML ERROR');  // For testing
        } catch (Exception ex) {
            Database.rollback(sp);
            System.debug(System.LoggingLevel.ERROR, ex.getMessage());
            throw ex;
        }
    }

    @AuraEnabled
    public static void queueSaveOrderItems(Id orderId, List<OrderItem> orderItemsToUpsert, List<OrderItem> orderItemsToDelete) {
        /* Need to check if item with the same Product2Id is in the order.
           Because we don't update Id in LWC we can't rely on this information
           (user can save order multiple time without reloading page) */
        List<OrderItem> orderItems = [SELECT Product2Id FROM OrderItem WHERE OrderId = :orderId];
        Map<Id, OrderItem> productIdToOrderItemMap = new Map<Id, OrderItem>();
        for (OrderItem orderItem : orderItems) productIdToOrderItemMap.put(orderItem.Product2Id, orderItem);

        // Update Ids for items to upsert
        for (OrderItem orderItem : orderItemsToUpsert) {
            OrderItem existingOrderItem = productIdToOrderItemMap.get(orderItem.Product2Id);
            if (existingOrderItem != null) orderItem.Id = existingOrderItem.Id;
        }

        // Update Ids for items to delete
        for (OrderItem orderItem : orderItemsToDelete) {
            OrderItem existingOrderItem = productIdToOrderItemMap.get(orderItem.Product2Id);
            if (existingOrderItem != null) orderItem.Id = existingOrderItem.Id;
        }

        /* We upsert all order items even there fields haven't changed (to update Last Modified Date).
           Records can be filtered to insert new records and update only those with changed quantity (if needed) */
        System.enqueueJob(new SaveOrderAsync(orderItemsToUpsert, orderItemsToDelete));
    }

    @AuraEnabled
    public static String getSaveAsyncStatus(Datetime asyncStartedDatetime) {
        List<AsyncApexJob> jobs = [
                SELECT Status
                FROM AsyncApexJob
                WHERE ApexClass.Name='SaveOrderAsync' AND CreatedDate >= :asyncStartedDatetime
                AND CreatedById = :UserInfo.getUserId()
        ];
        Integer completedJobs = 0;
        for (AsyncApexJob job : jobs) {
            if (job.Status == 'Completed') {
                completedJobs++;
            } else if (job.Status == 'Failed') {
                throw new AuraHandledException('Unknown error while saving order');
            }
        }
        return (completedJobs == jobs.size() ? 'Completed' : 'Processing');
    }


    private static Order getOrderToConfirm(Id orderId) {
        if (orderId == null) throw new AuraHandledException('getOrderToConfirm(): orderId can\'t be null');

        Order order = [
                SELECT Account.AccountNumber, Contract.Status, OrderNumber, Status, Type, (
                        SELECT Product2.Name, Product2.ProductCode, Quantity, UnitPrice
                        FROM OrderItems
                )
                FROM Order
                WHERE Id = :orderId
        ]?.get(0);
        return order;
    }

    private static String generateRequestBody(Order order) {
        JSONGenerator jsonGenerator = JSON.createGenerator(true);
        jsonGenerator.writeStartObject();
        jsonGenerator.writeStringField('accountNumber', nullToEmptyString(order.Account.AccountNumber));
        jsonGenerator.writeStringField('orderNumber', nullToEmptyString(order.OrderNumber));
        jsonGenerator.writeStringField('type', nullToEmptyString(order.Type));
        jsonGenerator.writeStringField('status', nullToEmptyString(order.Status));

        jsonGenerator.writeFieldName('orderProducts');
        jsonGenerator.writeStartArray();
        for (OrderItem orderItem : order.OrderItems) {
            jsonGenerator.writeStartObject();
            jsonGenerator.writeStringField('name', nullToEmptyString(orderItem.Product2.Name));
            jsonGenerator.writeStringField('code', nullToEmptyString(orderItem.Product2.ProductCode));
            jsonGenerator.writeNumberField('unitPrice', orderItem.UnitPrice);
            jsonGenerator.writeNumberField('quantity', (Integer) orderItem.Quantity);
            jsonGenerator.writeEndObject();
        }
        jsonGenerator.writeEndArray();
        jsonGenerator.writeEndObject();

        return jsonGenerator.getAsString();
    }

    private static String nullToEmptyString(String str) {
        return str == null ? '' : str;
    }
}