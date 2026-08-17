'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@/lib/auth-client';
import { Button } from '@/app/_components/ui/Button';

function Field({
  label,
  id,
  type,
  value,
  onChange,
}: {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[16px] font-medium mb-2"
        style={{ color: "var(--ink)" }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="block w-full text-[16px] px-3 py-[8px] transition-colors focus:outline-none"
        style={{
          background: "var(--surface-soft)",
          color: "var(--ink)",
          border: "1px solid var(--hairline)",
          borderRadius: "4px",
          fontFamily: "inherit",
        }}
        onFocus={(e) => {
          e.target.style.background = "var(--canvas)";
          e.target.style.borderColor = "var(--ink)";
        }}
        onBlur={(e) => {
          e.target.style.background = "var(--surface-soft)";
          e.target.style.borderColor = "var(--hairline)";
        }}
      />
    </div>
  );
}

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signUp.email({ name, email, password });
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Wordmark */}
      <div
        className="mb-12 pb-8"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <p
          className="text-[38px] font-bold leading-[1.5]"
          style={{ color: "var(--ink)" }}
        >
          DELTA
        </p>
        <p className="text-[16px] mt-1" style={{ color: "var(--mute)" }}>
          create your account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="name" id="name" type="text" value={name} onChange={setName} />
        <Field label="email" id="email" type="email" value={email} onChange={setEmail} />
        <Field label="password" id="password" type="password" value={password} onChange={setPassword} />

        {error && (
          <p className="text-[14px]" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          <Link
            href="/sign-in"
            className="text-[16px] transition-colors"
            style={{ color: "var(--mute)" }}
          >
            have an account? sign in →
          </Link>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'creating...' : 'create account →'}
          </Button>
        </div>
      </form>
    </div>
  );
}
