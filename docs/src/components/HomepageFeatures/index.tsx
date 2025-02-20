import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg?: React.ComponentType<React.ComponentProps<'svg'>>;
  imgSrc?: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Private and Secure',
    // https://www.flaticon.com/free-icon/hacker_8293502
    imgSrc: '/img/hacker.png',
    description: (
      <>
        Cyd runs directly on your computer, not on our servers. We don't have access
        to any of your accounts, or to any of the data in them.
      </>
    ),
  },
  {
    title: 'Enshittification-Proof',
    // https://www.flaticon.com/free-icon/no-poop_1742505
    imgSrc: '/img/no-poop.png',
    description: (
      <>
        Cyd doesn't rely on third-party APIs from hostile tech platforms like X and Facebook.
      </>
    ),
  },
  {
    title: 'Open Source',
    // https://www.flaticon.com/free-icon/programming_6062646
    imgSrc: '/img/programming.png',
    description: (
      <>
        Cyd is open source software developed by Lockdown Systems Collective for the social
        good. The code is available on <a href="https://github.com/lockdown-systems/cyd">GitHub</a>.
      </>
    ),
  },
];

function Feature({ title, Svg, imgSrc, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {Svg ? <Svg className={styles.featureSvg} role="img" /> : <img src={imgSrc} className={styles.featureImg} alt={title} />}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
