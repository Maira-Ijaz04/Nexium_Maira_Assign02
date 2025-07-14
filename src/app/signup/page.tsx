import AuthForm from '@/components/AuthForm';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <AuthForm mode="signup" />
    </div>
  );
}
