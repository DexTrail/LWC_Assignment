/**
 * Created by Dmitry Ivakhnenko on 07-Jul-2021.
 */

public without sharing class SaveOrderAsync implements Queueable {

    /* In case we need to process less records than 200.
       For example there are many flows and triggers and CPU limits are exceeded.
       It also allows to simulate many queues */
    private static final Integer MAX_RECORDS = 1;

    private List<OrderItem> orderItemsToUpsert;
    private List<OrderItem> orderItemsToDelete;


    public SaveOrderAsync(List<OrderItem> orderItemsToUpsert, List<OrderItem> orderItemsToDelete) {
        this.orderItemsToUpsert = orderItemsToUpsert;
        this.orderItemsToDelete = orderItemsToDelete;
    }

    public void execute(QueueableContext context) {
        List<OrderItem> orderItemsToUpsertNow = new List<OrderItem>();
        Integer numberOfRecords = (orderItemsToUpsert.size() < MAX_RECORDS ? orderItemsToUpsert.size() : MAX_RECORDS);
        for (Integer i = 0; i < numberOfRecords; i++) {
            orderItemsToUpsertNow.add(orderItemsToUpsert.get(0));
            orderItemsToUpsert.remove(0);
        }

        List<OrderItem> orderItemsToDeleteNow = new List<OrderItem>();
        numberOfRecords = (orderItemsToDelete.size() < MAX_RECORDS ? orderItemsToDelete.size() : MAX_RECORDS);
        for (Integer i = 0; i < numberOfRecords; i++) {
            orderItemsToDeleteNow.add(orderItemsToDelete.get(0));
            orderItemsToDelete.remove(0);
        }

        OrderProductsController.saveOrderItems(orderItemsToUpsertNow, orderItemsToDeleteNow);
        if ((!orderItemsToUpsert.isEmpty() || !orderItemsToDelete.isEmpty()) && !Test.isRunningTest()) {
            System.enqueueJob(new SaveOrderAsync(orderItemsToUpsert, orderItemsToDelete));
        }
    }
}