/**
 * Created by Dmitry Ivakhnenko on 05-Jul-2021.
 *
 * Creates test data for unit tests
 */

@IsTest
public class TestData {

    public static void loadTestData() {
        List<Product2> products = new List<Product2>();
        products.add(new Product2(Name='Product1'));
        products.add(new Product2(Name='Product2'));
        products.add(new Product2(Name='Product3'));
        insert products;

        List<Pricebook2> priceBooks = new List<Pricebook2>();
        priceBooks.add(new Pricebook2(Name='Pricebook1', IsActive=true));
        priceBooks.add(new Pricebook2(Name='Pricebook2', IsActive=true));
        insert priceBooks;

        Id standardPriceBookId = Test.getStandardPricebookId();
        List<PricebookEntry> pricebookEntries = new List<PricebookEntry>();
        pricebookEntries.add(new PricebookEntry(Product2Id=products[0].Id, Pricebook2Id=standardPriceBookId, IsActive=true,
                UnitPrice=2, UseStandardPrice=false));
        pricebookEntries.add(new PricebookEntry(Product2Id=products[1].Id, Pricebook2Id=standardPriceBookId, IsActive=true,
                UnitPrice=20, UseStandardPrice=false));
        pricebookEntries.add(new PricebookEntry(Product2Id=products[2].Id, Pricebook2Id=standardPriceBookId, IsActive=true,
                UnitPrice=200, UseStandardPrice=false));
        insert pricebookEntries;

        pricebookEntries = new List<PricebookEntry>();
        pricebookEntries.add(new PricebookEntry(Product2Id=products[0].Id, Pricebook2Id=priceBooks[0].Id, IsActive=false,
                UnitPrice=1, UseStandardPrice=false));
        pricebookEntries.add(new PricebookEntry(Product2Id=products[1].Id, Pricebook2Id=priceBooks[0].Id, IsActive=true,
                UnitPrice=10, UseStandardPrice=false));
        pricebookEntries.add(new PricebookEntry(Product2Id=products[2].Id, Pricebook2Id=priceBooks[0].Id, IsActive=true,
                UnitPrice=100, UseStandardPrice=false));
        pricebookEntries.add(new PricebookEntry(Product2Id=products[1].Id, Pricebook2Id=priceBooks[1].Id, IsActive=false,
                UnitPrice=1000, UseStandardPrice=false));
        pricebookEntries.add(new PricebookEntry(Product2Id=products[2].Id, Pricebook2Id=priceBooks[1].Id, IsActive=false,
                UnitPrice=10000, UseStandardPrice=false));
        insert pricebookEntries;

        Account account = new Account(Name='Test Account1');
        insert account;

        Contract contract = new Contract(AccountId=account.Id, StartDate=Date.today(), ContractTerm=6, Status='Draft');
        insert contract;
        contract.Status = 'Activated';
        update contract;

        List<Order> orders = new List<Order>();
        orders.add(new Order(Name='Order1', Pricebook2Id=priceBooks[0].Id, AccountId=account.Id, ContractId=contract.Id,
                EffectiveDate=Date.today(), Status='Draft'));
        orders.add(new Order(Name='Order2', Pricebook2Id=priceBooks[1].Id, AccountId=account.Id, ContractId=contract.Id,
                EffectiveDate=Date.today(), Status='Draft'));
        insert orders;

        List<OrderItem> orderItems = new List<OrderItem>();
        orderItems.add(new OrderItem(OrderId=orders[0].Id, Product2Id=products[1].Id, PricebookEntryId=pricebookEntries[1].Id,
                Quantity=2, UnitPrice=10));
        orderItems.add(new OrderItem(OrderId=orders[0].Id, Product2Id=products[2].Id, PricebookEntryId=pricebookEntries[2].Id,
                Quantity=3, UnitPrice=15));
        insert orderItems;
    }
}