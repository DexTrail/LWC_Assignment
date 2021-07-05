/**
 * Created by Dmitry Ivakhnenko on 04-Jul-2021.
 */

@IsTest
private with sharing class Test_ProductsListController {

    @TestSetup
    static void init() {
        TestData.loadTestData();
    }

    @IsTest
    static void getPricebookEntries_NoActiveRecords() {
        Order order = [SELECT Id FROM Order WHERE Name = 'Order2'];
        Test.startTest();
        List<PricebookEntry> result = ProductsListController.getPricebookEntries(order.Id);
        Test.stopTest();
        System.assert(result.isEmpty());
    }

    @IsTest
    static void getPricebookEntries_ActiveRecords() {
        Order order = [SELECT Id FROM Order WHERE Name = 'Order1'];
        Test.startTest();
        List<PricebookEntry> result = ProductsListController.getPricebookEntries(order.Id);
        Test.stopTest();
        System.assertEquals(2, result.size());
    }
}