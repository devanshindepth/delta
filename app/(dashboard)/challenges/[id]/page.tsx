import { redirect } from 'next/navigation';

export default function ChallengeRedirect({ params }: { params: { id: string } }) {
  redirect(`/practice/${params.id}`);
}
