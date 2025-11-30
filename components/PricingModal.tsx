import React, { useState, useEffect } from 'react';
import { Check, CreditCard, X, Crown, ShieldCheck, CalendarClock, Timer } from 'lucide-react';
import Button from './Button';

export type ModalView = 'PLANS' | 'PAYMENT' | 'MANAGE' | 'FEEDBACK';

interface PricingModalProps {
  onClose: () => void;
  onUpgrade: (planType: 'subscription' | 'pass') => void;
  onDowngradeSubmit: () => void;
  isPremium: boolean;
  premiumType?: 'subscription' | 'pass' | 'none';
  initialView?: ModalView;
}

type PlanKey = 'pass' | 'weekly' | 'monthly' | 'yearly';

const PricingModal: React.FC<PricingModalProps> = ({ 
  onClose, 
  onUpgrade, 
  onDowngradeSubmit, 
  isPremium,
  premiumType = 'none',
  initialView = 'PLANS'
}) => {
  const [view, setView] = useState<ModalView>(initialView);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  // Form State
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  // If initialView changes (e.g. parent re-opens it), reset view
  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const plans = {
    pass: { price: '$5.00', label: '5 Minute Pass', sub: 'One-time access for 5 mins', type: 'pass' },
    weekly: { price: '$2.99', label: 'Weekly', sub: 'Billed every 7 days', type: 'subscription' },
    monthly: { price: '$25.00', label: 'Monthly', sub: 'Billed every month', type: 'subscription' },
    yearly: { price: '$500.00', label: 'Yearly', sub: 'Billed annually', type: 'subscription' }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsProcessing(false);
    
    const type = plans[selectedPlan].type as 'subscription' | 'pass';
    onUpgrade(type);
    onClose();
  };

  const handleDowngradeRequest = () => {
      // Logic moved to parent: Instant close, start async timer in App
      onDowngradeSubmit();
      onClose();
  };

  const getNextPaymentDate = (plan: PlanKey = selectedPlan) => {
    if (plans[plan].type === 'pass') return 'N/A (One-time)';
    
    const date = new Date();
    if (plan === 'weekly') date.setDate(date.getDate() + 7);
    if (plan === 'monthly') date.setMonth(date.getMonth() + 1);
    if (plan === 'yearly') date.setFullYear(date.getFullYear() + 1);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // --------------------------------------------------------------------------
  // VIEW: FEEDBACK FORM (Downgrade Flow)
  // --------------------------------------------------------------------------
  if (view === 'FEEDBACK') {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#141414] rounded-2xl border border-[#333] shadow-2xl w-full max-w-md p-8 relative">
                <button onClick={() => isPremium ? setView('MANAGE') : onClose()} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-6 h-6" /></button>
                
                <h2 className="text-xl font-bold text-white mb-4">We're sorry to see you go</h2>
                <p className="text-gray-400 text-sm mb-6">
                    Please tell us why you are going back to the free plan. Your feedback helps us improve.
                </p>

                <textarea 
                    className="w-full h-32 bg-[#1a1a1a] border border-[#333] rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-6"
                    placeholder="I'm switching because..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                />

                <Button 
                    onClick={handleDowngradeRequest}
                    className="w-full"
                    disabled={feedback.length < 5}
                >
                    Submit Request & Return to Free
                </Button>
            </div>
        </div>
      );
  }

  // --------------------------------------------------------------------------
  // VIEW: MANAGE SUBSCRIPTION (If already Premium)
  // --------------------------------------------------------------------------
  if (view === 'MANAGE') {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#141414] rounded-2xl border border-[#333] shadow-2xl w-full max-w-md p-8 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-6 h-6" /></button>
                
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-900/20 mb-4">
                        <Crown className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Premium Active</h2>
                    <p className="text-gray-400 mt-2">You have full access to all features.</p>
                </div>

                <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#333] mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400 text-sm">Current Plan</span>
                        <span className="text-white font-semibold">
                            {premiumType === 'pass' ? '5 Minute Pass' : 'Monthly Pro'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400 text-sm">Status</span>
                        <span className="text-green-400 text-sm font-bold flex items-center">
                            <Check className="w-3 h-3 mr-1" /> Active
                        </span>
                    </div>
                    {premiumType === 'subscription' && (
                        <div className="flex justify-between items-center border-t border-[#333] pt-2 mt-2">
                            <span className="text-gray-400 text-sm">Next Payment</span>
                            <span className="text-gray-300 text-sm font-mono">
                                {getNextPaymentDate('monthly')}
                            </span>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    {premiumType === 'pass' ? (
                        <Button 
                            onClick={() => {
                                setView('PLANS'); // Allow buying another pass or subscribing
                            }} 
                            className="w-full"
                        >
                            Extend / Upgrade
                        </Button>
                    ) : (
                        <>
                            <Button 
                                onClick={onClose} 
                                className="w-full bg-[#333] hover:bg-[#444] text-white border-none"
                            >
                                Keep Subscription
                            </Button>
                            <button 
                                onClick={() => setView('FEEDBACK')}
                                className="w-full py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                            >
                                Cancel Subscription & Downgrade
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW: PLANS SELECTION (Default Upgrade View)
  // --------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#141414] rounded-2xl border border-[#333] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col md:flex-row">
        
        {/* Left Side: Plans */}
        <div className="p-8 md:w-1/2 border-b md:border-b-0 md:border-r border-[#333]">
          <div className="flex items-center space-x-2 mb-6">
             <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-900/20">
                <Crown className="w-6 h-6 text-white" />
             </div>
             <div>
                <h2 className="text-2xl font-bold text-white">Upgrade to Pro</h2>
                <p className="text-sm text-gray-400">Unlock all filters & AI tools</p>
             </div>
          </div>

          <div className="space-y-4 mb-8">
            {/* 5 Minute Pass - Special Highlighting */}
            <div 
                onClick={() => setSelectedPlan('pass')}
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPlan === 'pass' 
                    ? 'border-purple-500 bg-purple-900/10' 
                    : 'border-[#333] bg-[#1a1a1a] hover:border-[#555]'
                }`}
            >
                <div className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center space-x-2">
                             <p className="font-bold text-white text-lg">{plans.pass.label}</p>
                             <span className="bg-purple-600 text-[10px] px-2 py-0.5 rounded text-white font-bold uppercase">One-Time</span>
                        </div>
                        <p className="text-xs text-gray-500">{plans.pass.sub}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-mono text-xl font-bold text-purple-400">{plans.pass.price}</p>
                    </div>
                </div>
                {selectedPlan === 'pass' && (
                    <div className="absolute top-0 right-0 -mt-2 -mr-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                    </div>
                )}
            </div>
            
            <div className="w-full h-[1px] bg-[#333] my-4"></div>

            {/* Subscriptions */}
            {(['weekly', 'monthly', 'yearly'] as PlanKey[]).map((planKey) => (
              <div 
                key={planKey}
                onClick={() => setSelectedPlan(planKey)}
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPlan === planKey 
                    ? 'border-blue-500 bg-blue-900/10' 
                    : 'border-[#333] bg-[#1a1a1a] hover:border-[#555]'
                }`}
              >
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-bold text-white text-lg">{plans[planKey].label}</p>
                        <p className="text-xs text-gray-500">{plans[planKey].sub}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-mono text-xl font-bold text-blue-400">{plans[planKey].price}</p>
                    </div>
                </div>
                {selectedPlan === planKey && (
                    <div className="absolute top-0 right-0 -mt-2 -mr-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                    </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center text-sm text-gray-400">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                <span>Unlimited Exports</span>
            </div>
            <div className="flex items-center text-sm text-gray-400">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                <span>Access to all 8+ Premium Filters</span>
            </div>
             <div className="flex items-center text-sm text-gray-400">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                <span>Advanced AI Metadata Analysis</span>
            </div>
          </div>
        </div>

        {/* Right Side: Payment */}
        <div className="p-8 md:w-1/2 bg-[#0f0f0f] relative">
           <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-500 hover:text-white"
           >
               <X className="w-6 h-6" />
           </button>

           <h3 className="text-lg font-semibold text-white mb-6">Payment Details</h3>
           
           <form onSubmit={handleSubscribe} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Card Number</label>
                    <div className="relative">
                        <CreditCard className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                        <input 
                            type="text" 
                            required
                            placeholder="0000 0000 0000 0000"
                            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex space-x-4">
                    <div className="flex-1 space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Expiry</label>
                        <input 
                            type="text" 
                            required
                            placeholder="MM/YY"
                            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-center"
                            value={expiry}
                            onChange={(e) => setExpiry(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">CVC</label>
                        <input 
                            type="text" 
                            required
                            placeholder="123"
                            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-center"
                            value={cvc}
                            onChange={(e) => setCvc(e.target.value)}
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <Button 
                        type="submit" 
                        className="w-full py-4 text-lg"
                        isLoading={isProcessing}
                    >
                        Pay {plans[selectedPlan].price}
                    </Button>
                    
                    <div className="flex items-center justify-center mt-4 text-xs text-gray-600 space-x-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Secure SSL Encryption</span>
                    </div>

                    {plans[selectedPlan].type === 'subscription' && (
                        <div className="text-center mt-4 pt-4 border-t border-[#222]">
                             <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
                                <CalendarClock className="w-3 h-3"/>
                                Next payment due: <span className="text-gray-300 font-medium">{getNextPaymentDate()}</span>
                             </p>
                        </div>
                    )}
                    {plans[selectedPlan].type === 'pass' && (
                        <div className="text-center mt-4 pt-4 border-t border-[#222]">
                             <p className="text-xs text-purple-400 flex items-center justify-center gap-2">
                                <Timer className="w-3 h-3"/>
                                Pass expires 5 minutes after purchase
                             </p>
                        </div>
                    )}
                </div>
           </form>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;