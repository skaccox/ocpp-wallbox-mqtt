ARG BUILD_FROM
FROM ${BUILD_FROM}

ENV PERL_MM_USE_DEFAULT=1
ENV PERL_CPANM_OPT="--notest"

# Runtime + build deps (Alpine)
RUN apk add --no-cache \
    perl \
    perl-utils \
    bash \
    python3 \
    ca-certificates \
    git \
    make \
    gcc \
    musl-dev \
    perl-dev \
    perl-app-cpanminus

# Moduli CPAN necessari
RUN cpanm JSON \
 && cpanm Config::IniFiles \
 && cpanm Time::HiRes \
 && cpanm MQTT::Simple || true \
 && cpanm Mojolicious || true


# Pulizia build deps (lascia perl + cpanm)
RUN apk del --no-cache \
    make gcc musl-dev perl-dev

COPY rootfs /

COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
