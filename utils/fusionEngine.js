const Donation = require('../models/Donation');
const Fusion = require('../models/Fusion');
const User = require('../models/User');

async function runFusion() {
  try {
    // ETAPE 1 : Tous les fondateurs recoivent chacun 2 dons au depart
    var founders = await User.find({ sponsorCode: 'AUCUN' }).sort({ createdAt: 1 });
    var founderIds = founders.map(function(f) { return f._id; });

    for (var f = 0; f < founders.length; f++) {
      var founder = founders[f];
      var received = await Fusion.countDocuments({
        receiverId: founder._id,
        receiverDonationId: null
      });

      if (received < 2) {
        var remaining = 2 - received;
        var pendingForFounder = await Donation.find({
          status: 'pending',
          userId: { $nin: founderIds }
        }).sort({ createdAt: 1 }).limit(remaining);

        for (var i = 0; i < pendingForFounder.length; i++) {
          var d = pendingForFounder[i];
          var fusion = new Fusion({
            payerId: d.userId,
            receiverId: founder._id,
            payerDonationId: d._id,
            receiverDonationId: null,
            amount: d.amount,
            status: 'active'
          });
          await fusion.save();

          d.status = 'fused';
          d.fusionId = fusion._id;
          await d.save();

          console.log('Fusion fondateur (' + founder.fullName + '): recoit ' + d.amount + ' F de ' + d.userId);
        }
      }
    }

    // ETAPE 2 : Fusion avec les membres arrives a 100% (matures) qui doivent recevoir x2
    var completedFusions = await Fusion.find({ status: 'completed' }).sort({ endDate: 1 });

    for (var c = 0; c < completedFusions.length; c++) {
      var cf = completedFusions[c];
      // Le payeur de cette fusion a fini ses 25 jours : il doit recevoir 2 dons du meme montant
      var alreadyMatched = await Fusion.countDocuments({
        receiverId: cf.payerId,
        receiverDonationId: cf.payerDonationId
      });

      if (alreadyMatched < 2) {
        var need = 2 - alreadyMatched;
        var newDons = await Donation.find({
          status: 'pending',
          amount: cf.amount,
          userId: { $ne: cf.payerId }
        }).sort({ createdAt: 1 }).limit(need);

        for (var k = 0; k < newDons.length; k++) {
          var nd = newDons[k];
          var matFusion = new Fusion({
            payerId: nd.userId,
            receiverId: cf.payerId,
            payerDonationId: nd._id,
            receiverDonationId: cf.payerDonationId,
            amount: nd.amount,
            status: 'active'
          });
          await matFusion.save();

          nd.status = 'fused';
          nd.fusionId = matFusion._id;
          await nd.save();

          console.log('Fusion maturite: ' + nd.userId + ' paie ' + nd.amount + ' F a ' + cf.payerId);
        }
      }
    }
  } catch (err) {
    console.error('Erreur fusion:', err.message);
  }
}

module.exports = { runFusion };