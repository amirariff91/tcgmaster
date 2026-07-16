'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trackContactFormSubmitted } from '@/lib/analytics';

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  topic: z.enum(['support', 'feedback', 'partnership', 'press', 'other'], {
    message: 'Please select a topic',
  }),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactFormData = z.infer<typeof contactSchema>;

const topics = [
  { value: 'support', label: 'Support' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'press', label: 'Press' },
  { value: 'other', label: 'Other' },
];

export default function ContactPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Track submission
    trackContactFormSubmitted(data.topic);

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#060c18] flex items-center justify-center relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-600/15 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="container py-20 relative z-10">
          <div className="max-w-md mx-auto text-center bg-[#0b1329]/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Message Sent!</h1>
            <p className="text-zinc-400 mb-8">
              Thank you for reaching out. We&apos;ll get back to you as soon as possible.
            </p>
            <Button onClick={() => setIsSubmitted(false)} variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white transition-all">
              Send Another Message
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060c18] pt-24 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-600/15 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="container py-16 relative z-10">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-8 relative z-10">
            <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">Contact Us</h1>
            <p className="text-zinc-400">
              Have a question or feedback? We&apos;d love to hear from you.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-[#0b1329]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6 md:p-8 space-y-6 shadow-2xl relative z-10"
          >
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-zinc-300">Name</Label>
              <Input
                id="name"
                placeholder="Your name"
                {...register('name')}
                error={errors.name?.message}
                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-orange-500/50 focus-visible:border-orange-500"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
                error={errors.email?.message}
                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-orange-500/50 focus-visible:border-orange-500"
              />
            </div>

            {/* Topic */}
            <div className="space-y-2">
              <Label htmlFor="topic" className="text-zinc-300">Topic</Label>
              <select
                id="topic"
                {...register('topic')}
                className={cn(
                  'flex h-10 w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-white',
                  'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  errors.topic ? 'border-red-500' : 'border-white/10'
                )}
              >
                <option value="">Select a topic</option>
                {topics.map((topic) => (
                  <option key={topic.value} value={topic.value}>
                    {topic.label}
                  </option>
                ))}
              </select>
              {errors.topic && (
                <p className="text-sm text-red-500">{errors.topic.message}</p>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message" className="text-zinc-300">Message</Label>
              <textarea
                id="message"
                rows={5}
                placeholder="How can we help?"
                {...register('message')}
                className={cn(
                  'flex w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-600',
                  'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'resize-none',
                  errors.message ? 'border-red-500' : 'border-white/10'
                )}
              />
              {errors.message && (
                <p className="text-sm text-red-500">{errors.message.message}</p>
              )}
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold tracking-wide shadow-[0_0_15px_rgba(249,115,22,0.4)] border-none" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </form>

          {/* Additional Info */}
          <div className="mt-8 text-center text-sm text-zinc-400">
            <p>
              For urgent matters, you can also reach us at{' '}
              <a
                href="mailto:support@tcgmaster.com"
                className="text-orange-400 hover:text-orange-300 transition-colors font-medium"
              >
                support@tcgmaster.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
