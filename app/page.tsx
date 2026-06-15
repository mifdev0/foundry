import { redirect } from "next/navigation";

interface HomeProps {
  searchParams: {
    code?: string;
    [key: string]: string | string[] | undefined;
  };
}

export default function Home({ searchParams }: HomeProps) {
  if (searchParams?.code) {
    redirect(`/auth/callback?code=${searchParams.code}`);
  }
  redirect("/dashboard");
}
