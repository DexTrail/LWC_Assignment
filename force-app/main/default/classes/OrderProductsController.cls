/**
 * Created by Dmitry Ivakhnenko on 29-Jun-2021.
 */

public with sharing class OrderProductsController {

    // This can be put in custom settings or custom metadata
    private static final String CONFIRM_ENDPOINT = 'https://pentagone.requestcatcher.com/';


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
        httpRequest.setTimeout(1000);

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

    @AuraEnabled
    public static List<OrderItem> saveOrderItems(List<OrderItem> orderItemsToUpsert, List<OrderItem> orderItemsToDelete) {
        Savepoint sp = Database.setSavepoint();
        try {
            if (orderItemsToUpsert != null && !orderItemsToUpsert.isEmpty()) upsert orderItemsToUpsert;
            if (orderItemsToDelete != null && !orderItemsToDelete.isEmpty()) delete orderItemsToDelete;
            //throw new AuraHandledException('SOME ERROR');
        } catch (Exception ex) {
            Database.rollback(sp);
            System.debug(System.LoggingLevel.ERROR, ex.getMessage());
            throw ex;
        }
        return orderItemsToUpsert;
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