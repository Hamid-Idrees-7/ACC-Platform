using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Backend.Live
{
    // Sends the live update of changes saved inside a transaction once it commits, and drops it
    // if the transaction is rolled back.
    public class LiveTransactionInterceptor : DbTransactionInterceptor
    {
        private readonly LiveChangeInterceptor _live;

        public LiveTransactionInterceptor(LiveChangeInterceptor live)
        {
            _live = live;
        }

        public override void TransactionCommitted(DbTransaction transaction, TransactionEndEventData eventData)
        {
            _live.TransactionEnded(eventData.Context, committed: true);
            base.TransactionCommitted(transaction, eventData);
        }

        public override Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData eventData,
            CancellationToken cancellationToken = default)
        {
            _live.TransactionEnded(eventData.Context, committed: true);
            return base.TransactionCommittedAsync(transaction, eventData, cancellationToken);
        }

        public override void TransactionRolledBack(DbTransaction transaction, TransactionEndEventData eventData)
        {
            _live.TransactionEnded(eventData.Context, committed: false);
            base.TransactionRolledBack(transaction, eventData);
        }

        public override Task TransactionRolledBackAsync(DbTransaction transaction, TransactionEndEventData eventData,
            CancellationToken cancellationToken = default)
        {
            _live.TransactionEnded(eventData.Context, committed: false);
            return base.TransactionRolledBackAsync(transaction, eventData, cancellationToken);
        }
    }
}
