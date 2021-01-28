import { Message } from '@prisma/client';
import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { dehydrate } from 'react-query/hydration';
import { chatRouter } from './api/trpc/[...trpc]';
import { hooks } from './_app';

function maxDate(dates: Date[]) {
  let max = dates[0];

  for (const date of dates) {
    if (date.getTime() > max.getTime()) {
      max = date;
    }
  }

  return max ?? null;
}
const getTimestamp = (m: Message[]) => {
  return m.reduce((ts, msg) => {
    return maxDate([ts, msg.updatedAt, msg.createdAt]);
  }, new Date(0));
};

export default function Home() {
  const query = hooks.useQuery('messages.list');

  const [msgs, setMessages] = useState(() => query.data.items ?? []);
  const addMessages = (newMessages?: Message[]) => {
    setMessages((nowMessages) => {
      const map: Record<Message['id'], Message> = {};
      for (const msg of nowMessages) {
        map[msg.id] = msg;
      }
      for (const msg of newMessages ?? []) {
        map[msg.id] = msg;
      }
      return Object.values(map).sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
    });
  };
  // get latest timestamp
  const timestamp = useMemo(() => getTimestamp(msgs), [msgs]);

  // merge messages when `query.data` updates
  useEffect(() => addMessages(query.data?.items), [query.data]);

  // ---subscriptions
  const subscription = hooks.useSubscription([
    'messages.newMessages',
    { timestamp },
  ]);

  // merge messages on subscription.data
  useEffect(() => addMessages(subscription.data), [subscription.data]);

  console.log({ timestamp });

  const addMessage = hooks.useMutation('messages.create');

  return (
    <div>
      <Head>
        <title>Chat</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <h1>Chat</h1>

      <h2>Message</h2>
      <ul>
        {msgs.map((m) => (
          <li key={m.id}>
            {m.createdAt.toDateString()} {m.createdAt.toLocaleTimeString()}:{' '}
            {m.text}
          </li>
        ))}
      </ul>
      <h3>Add message</h3>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const $text: HTMLInputElement = (e as any).target.elements.text;
          const input = {
            text: $text.value,
          };

          try {
            const res = await addMessage.mutateAsync(input);
            $text.value = '';
            addMessages([res]);
          } catch (err) {}
        }}
      >
        <input name="text" type="text" />
        <input type="submit" disabled={addMessage.isLoading} />
      </form>
    </div>
  );
}
export async function getStaticProps() {
  await hooks.prefetchQuery(chatRouter, {
    path: 'messages.list',
    input: null,
    ctx: {} as any,
  });
  return {
    props: {
      dehydratedState: dehydrate(hooks.queryClient),
    },
    revalidate: 1,
  };
}