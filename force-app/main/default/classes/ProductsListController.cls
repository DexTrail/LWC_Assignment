/**
 * Created by Dmitry Ivakhnenko on 29-Jun-2021.
 */

public with sharing class ProductsListController {

    @AuraEnabled(Cacheable=true)
    public static List<PricebookEntry> getPricebookEntries(Id orderId) {
        List<PricebookEntry> pricebookEntries = new List<PricebookEntry>();

        Order order = [SELECT Pricebook2Id FROM Order WHERE Id = :orderId];
        if (order.Pricebook2Id == null) return pricebookEntries;

        /* Product Name and Unit Price - that's what we need */
        pricebookEntries = [
                SELECT Product2.Name, UnitPrice
                FROM PricebookEntry
                WHERE Pricebook2Id = :order.Pricebook2Id AND IsActive = TRUE
                WITH SECURITY_ENFORCED
                ORDER BY Product2.Name
        ];
        return pricebookEntries;
    }
}